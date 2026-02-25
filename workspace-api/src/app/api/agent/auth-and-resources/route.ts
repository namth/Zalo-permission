/**
 * POST /api/agent/auth-and-resources
 *
 * Core agent API used by n8n Planner to:
 * 1. Authenticate user via Neo4j (ZaloUser → ZaloGroup → Workspace)
 * 2. Check for pending tasks (AWAITING_INPUT) for this thread
 * 3. Retrieve allowed tools & skills via Hybrid Search (pgvector + Neo4j whitelist)
 *
 * Spec: AI AGENT WORKSPACE SYSTEM.md §6.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { neo4jClient } from '@/lib/neo4j';
import { embeddingClient } from '@/lib/embedding';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthAndResourcesRequest {
    zalo_user_id: string;   // Zalo UID of the caller
    thread_id: string;      // Zalo group thread_id
    content?: string;       // Optional: user message for semantic search
}

interface ToolResult {
    id: string;
    key: string;
    name: string;
    description: string | null;
    input_schema: any;
    status: string;
    similarity?: number;
}

interface SkillResult {
    id: string;
    name: string;
    description: string | null;
    logic_config: any;
    is_shared: boolean;
    owner_id: string;
    workspace_id: string;
    status: string;
    similarity?: number;
}

interface PendingTask {
    id: string;
    workspace_id: string;
    thread_id: string;
    user_id: string;
    intent: string | null;
    full_plan: any;
    missing_parameters: any;
    status: string;
    created_at: string;
    updated_at: string;
}

// ---------------------------------------------------------------------------
// Step 2: Fetch pending task for this thread
// ---------------------------------------------------------------------------

async function getPendingTask(threadId: string): Promise<PendingTask | null> {
    const result = await db.query(
        `SELECT id, workspace_id, thread_id, user_id, intent, full_plan, missing_parameters, status, created_at, updated_at
     FROM pending_tasks
     WHERE thread_id = $1 AND status = 'AWAITING_INPUT'
     ORDER BY created_at DESC
     LIMIT 1`,
        [threadId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
        ...row,
        full_plan: typeof row.full_plan === 'string' ? JSON.parse(row.full_plan) : row.full_plan,
        missing_parameters: typeof row.missing_parameters === 'string'
            ? JSON.parse(row.missing_parameters)
            : row.missing_parameters,
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    };
}

// ---------------------------------------------------------------------------
// Step 3a: Fetch tools by whitelist (no semantic search)
// ---------------------------------------------------------------------------

async function getToolsByKeys(toolKeys: string[]): Promise<ToolResult[]> {
    if (toolKeys.length === 0) return [];

    const placeholders = toolKeys.map((_, i) => `$${i + 1}`).join(', ');
    const result = await db.query(
        `SELECT id, key, name, description, input_schema, status
     FROM tools
     WHERE key = ANY(ARRAY[${placeholders}]) AND status = 'active'
     ORDER BY name ASC`,
        toolKeys
    );

    return result.rows.map(row => ({
        ...row,
        input_schema: typeof row.input_schema === 'string'
            ? JSON.parse(row.input_schema)
            : row.input_schema,
    }));
}

// ---------------------------------------------------------------------------
// Step 3b: Fetch skills by ID list (no semantic search)
// ---------------------------------------------------------------------------

async function getSkillsByIds(skillIds: string[]): Promise<SkillResult[]> {
    if (skillIds.length === 0) return [];

    const placeholders = skillIds.map((_, i) => `$${i + 1}`).join(', ');
    const result = await db.query(
        `SELECT id, name, description, logic_config, is_shared, owner_id, workspace_id, status
     FROM skills
     WHERE id = ANY(ARRAY[${placeholders}]) AND status = 'active'
     ORDER BY name ASC`,
        skillIds
    );

    return result.rows.map(row => ({
        ...row,
        logic_config: typeof row.logic_config === 'string'
            ? JSON.parse(row.logic_config)
            : row.logic_config,
    }));
}

// ---------------------------------------------------------------------------
// Step 3c: Hybrid search tools with pgvector + Neo4j whitelist filter
// ---------------------------------------------------------------------------

async function hybridSearchTools(
    queryVector: number[],
    allowedKeys: string[],
    limit = 10
): Promise<ToolResult[]> {
    if (allowedKeys.length === 0) return [];

    const placeholders = allowedKeys.map((_, i) => `$${i + 3}`).join(', ');
    const result = await db.query(
        `SELECT id, key, name, description, input_schema, status,
            1 - (embedding <-> $1::vector) AS similarity
     FROM tools
     WHERE embedding IS NOT NULL
       AND status = 'active'
       AND key = ANY(ARRAY[${placeholders}])
     ORDER BY similarity DESC
     LIMIT $2`,
        [JSON.stringify(queryVector), limit, ...allowedKeys]
    );

    return result.rows.map(row => ({
        id: row.id,
        key: row.key,
        name: row.name,
        description: row.description,
        input_schema: typeof row.input_schema === 'string'
            ? JSON.parse(row.input_schema)
            : row.input_schema,
        status: row.status,
        similarity: parseFloat(row.similarity),
    }));
}

// ---------------------------------------------------------------------------
// Step 3d: Hybrid search skills with pgvector + Neo4j whitelist filter
// ---------------------------------------------------------------------------

async function hybridSearchSkills(
    queryVector: number[],
    allowedIds: string[],
    limit = 10
): Promise<SkillResult[]> {
    if (allowedIds.length === 0) return [];

    const placeholders = allowedIds.map((_, i) => `$${i + 3}`).join(', ');
    const result = await db.query(
        `SELECT id, name, description, logic_config, is_shared, owner_id, workspace_id, status,
            1 - (embedding <-> $1::vector) AS similarity
     FROM skills
     WHERE embedding IS NOT NULL
       AND status = 'active'
       AND id = ANY(ARRAY[${placeholders}])
     ORDER BY similarity DESC
     LIMIT $2`,
        [JSON.stringify(queryVector), limit, ...allowedIds]
    );

    return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        logic_config: typeof row.logic_config === 'string'
            ? JSON.parse(row.logic_config)
            : row.logic_config,
        is_shared: row.is_shared,
        owner_id: row.owner_id,
        workspace_id: row.workspace_id,
        status: row.status,
        similarity: parseFloat(row.similarity),
    }));
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
    const startTime = Date.now();

    try {
        const body: AuthAndResourcesRequest = await req.json();
        const { zalo_user_id, thread_id, content } = body;

        logger.info(`[API] POST /api/agent/auth-and-resources - user: ${zalo_user_id}, thread: ${thread_id}`);

        // --- Validate required fields ---
        if (!zalo_user_id || !thread_id) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: zalo_user_id, thread_id' },
                { status: 400 }
            );
        }

        // -----------------------------------------------------------------------
        // Step 1: Neo4j Authorization
        // Verify: ZaloUser → PART_OF → Workspace ← BELONGS_TO ← ZaloGroup(thread_id)
        // -----------------------------------------------------------------------
        const authCtx = await neo4jClient.getAuthorizationContext(zalo_user_id, thread_id);

        if (!authCtx) {
            logger.warn(`[API] Auth failed: user ${zalo_user_id} has no access to thread ${thread_id}`);
            return NextResponse.json(
                {
                    success: false,
                    error: 'User is not authorized to access this workspace. Please verify membership.',
                },
                { status: 403 }
            );
        }

        const { workspaceId, role, availableTools, availableSkills } = authCtx;
        logger.info(`[API] Auth success: user ${zalo_user_id} → workspace ${workspaceId} (${role})`);

        // -----------------------------------------------------------------------
        // Step 2: Check pending tasks for this thread
        // -----------------------------------------------------------------------
        const pendingTask = await getPendingTask(thread_id);
        if (pendingTask) {
            logger.info(`[API] Found pending task ${pendingTask.id} (AWAITING_INPUT) for thread ${thread_id}`);
        }

        // -----------------------------------------------------------------------
        // Step 3: Retrieve tools & skills
        // If content provided → Hybrid Search (semantic + whitelist)
        // Otherwise → Return all whitelisted tools/skills from PostgreSQL
        // -----------------------------------------------------------------------
        let tools: ToolResult[] = [];
        let skills: SkillResult[] = [];

        if (content && content.trim().length > 0) {
            // Generate embedding for semantic search
            logger.info(`[API] Generating embedding for content: "${content.substring(0, 60)}..."`);
            let queryVector: number[];
            try {
                queryVector = await embeddingClient.generateEmbedding(content.trim());
            } catch (embErr) {
                // Fallback to whitelist-only if embedding fails (e.g. no OpenAI key)
                logger.warn(`[API] Embedding failed, falling back to whitelist-only: ${embErr}`);
                queryVector = [];
            }

            if (queryVector.length > 0) {
                // Hybrid search: vector similarity filtered by Neo4j whitelist
                [tools, skills] = await Promise.all([
                    hybridSearchTools(queryVector, availableTools, 10),
                    hybridSearchSkills(queryVector, availableSkills, 10),
                ]);
            } else {
                // Fallback: no embedding available, return full whitelist
                [tools, skills] = await Promise.all([
                    getToolsByKeys(availableTools),
                    getSkillsByIds(availableSkills),
                ]);
            }
        } else {
            // No content provided — return all whitelisted resources
            [tools, skills] = await Promise.all([
                getToolsByKeys(availableTools),
                getSkillsByIds(availableSkills),
            ]);
        }

        const elapsed = Date.now() - startTime;
        logger.info(
            `[API] auth-and-resources complete in ${elapsed}ms: ` +
            `workspace=${workspaceId}, tools=${tools.length}, skills=${skills.length}, ` +
            `pending=${pendingTask ? pendingTask.id : 'none'}`
        );

        return NextResponse.json(
            {
                success: true,
                data: {
                    workspace_id: workspaceId,
                    role,
                    pending_task: pendingTask,
                    tools,
                    skills,
                },
                meta: {
                    elapsed_ms: elapsed,
                    search_mode: content && content.trim().length > 0 ? 'hybrid' : 'whitelist',
                    tools_count: tools.length,
                    skills_count: skills.length,
                },
            },
            { status: 200 }
        );
    } catch (error) {
        logger.error(`[API] POST /api/agent/auth-and-resources error: ${error}`);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
