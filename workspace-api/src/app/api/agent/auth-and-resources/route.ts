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
    tool_group?: string;    // Optional: filter by tool group key
    category?: string;      // Optional: filter by skill category
    resource_type?: 'all' | 'skills' | 'tools' | 'pending_task' | 'none'; // Optional: filter by resource category
    tool_ids?: string[];    // Optional: get specific tools by UUID
    skill_ids?: string[];   // Optional: get specific skills by UUID
}

interface ToolResult {
    id: string;
    key: string;
    name: string;
    description: string | null;
    input_schema: any;
    output_schema: any;
    status: string;
    similarity?: number;
}

interface SkillResult {
    id: string;
    name: string;
    description: string | null;
    detail: string | null;
    is_shared: boolean;
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

interface UserProfile {
    id: string;
    full_name: string | null;
    gender: string | null;
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
// Step 2b: Fetch user profile from PostgreSQL
// ---------------------------------------------------------------------------

async function getUserProfile(zaloId: string): Promise<UserProfile | null> {
    const result = await db.query(
        `SELECT id, full_name, gender
         FROM user_profile
         WHERE zalo_id = $1 AND status = 'active'
         LIMIT 1`,
        [zaloId]
    );

    if (result.rows.length === 0) return null;
    return result.rows[0];
}

// ---------------------------------------------------------------------------
// Step 3a: Fetch tool groups and nested tools
// ---------------------------------------------------------------------------

interface ToolGroupResult {
    id: string;
    key: string;
    name: string;
    description: string | null;
    status: string;
    'context-data'?: any;
    tools: any;
}

async function getGroupedToolsByIds(toolIds: string[]): Promise<ToolGroupResult[]> {
    if (toolIds.length === 0) return [];

    // 1. Fetch tools details from PostgreSQL
    const toolsResult = await db.query(
        `SELECT id, key, name, description, input_schema, output_schema, status
         FROM tools
         WHERE id = ANY($1::uuid[]) AND status = 'active'
         ORDER BY name ASC`,
        [toolIds]
    );

    const tools = toolsResult.rows.map(row => ({
        ...row,
        input_schema: typeof row.input_schema === 'string'
            ? JSON.parse(row.input_schema)
            : row.input_schema,
        output_schema: typeof row.output_schema === 'string'
            ? JSON.parse(row.output_schema)
            : row.output_schema,
    }));

    if (tools.length === 0) return [];

    // 2. Query Neo4j for group assignments of THESE specific tools (ONLY to get the mapping tool_id -> group_id)
    const actualToolIds = tools.map(t => t.id);
    const neo4jRes = await neo4jClient.run(
        `MATCH (t:Tool)-[:BELONGS_TO_GROUP]->(tg:ToolGroup)
         WHERE t.id IN $toolIds
         RETURN t.id AS tool_id, tg.id AS group_id`,
        { toolIds: actualToolIds }
    );

    const toolToGroupId = new Map<string, string>();
    const uniqueGroupIds = new Set<string>();

    for (const record of neo4jRes.records) {
        const gid = record.get('group_id');
        toolToGroupId.set(record.get('tool_id'), gid);
        uniqueGroupIds.add(gid);
    }

    // 3. Fetch Tool Group details from PostgreSQL to ensure description is accurate
    const groupMap = new Map<string, ToolGroupResult>();
    if (uniqueGroupIds.size > 0) {
        const groupsResult = await db.query(
            `SELECT id, key, name, description, status
             FROM tool_groups
             WHERE id = ANY($1)`,
            [Array.from(uniqueGroupIds)]
        );

        for (const row of groupsResult.rows) {
            groupMap.set(row.id, {
                id: row.id,
                key: row.key,
                name: row.name,
                description: row.description,
                status: row.status,
                'context-data': [], // Placed before tools for order
                tools: [],
            });
        }
    }

    // 4. Assemble tools into groups
    const unassignedTools: ToolResult[] = [];
    for (const tool of tools) {
        const gid = toolToGroupId.get(tool.id);
        if (gid && groupMap.has(gid)) {
            groupMap.get(gid)!.tools!.push(tool);
        } else {
            unassignedTools.push(tool);
        }
    }

    const toolGroups: ToolGroupResult[] = Array.from(groupMap.values());

    // Tools without a group are placed in a virtual "General" group
    if (unassignedTools.length > 0) {
        toolGroups.push({
            id: 'general',
            key: 'general',
            name: 'General Tools',
            description: 'Uncategorized workspace tools',
            status: 'active',
            'context-data': [],
            tools: unassignedTools,
        });
    }

    return toolGroups;
}

// ---------------------------------------------------------------------------
// Step 3b: Fetch skills by ID list (no semantic search)
// ---------------------------------------------------------------------------

async function getSkillsByIds(skillIds: string[]): Promise<SkillResult[]> {
    if (skillIds.length === 0) return [];

    const result = await db.query(
        `SELECT id, name, description, detail, is_shared, status
     FROM skills
     WHERE id = ANY($1::uuid[]) AND status = 'active'
     ORDER BY name ASC`,
        [skillIds]
    );

    return result.rows;
}



// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
    const startTime = Date.now();

    try {
        const body: AuthAndResourcesRequest = await req.json();
        const { zalo_user_id, thread_id, content, tool_group, category, resource_type = 'all', tool_ids, skill_ids } = body;

        logger.info(`[API] POST /api/agent/auth-and-resources - user: ${zalo_user_id}, thread: ${thread_id}, type: ${resource_type}`);

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

        const { workspaceId, role, availableToolIds, availableSkills } = authCtx;
        logger.info(`[API] Auth success: user ${zalo_user_id} → workspace ${workspaceId} (${role})`);

        // -----------------------------------------------------------------------
        // Step 2 & 3: Determine what to fetch
        // Priority: If tool_ids or skill_ids are provided, ONLY fetch those specific items.
        // -----------------------------------------------------------------------
        const isNone = resource_type === 'none';
        const hasSpecificTools = !!(tool_ids && tool_ids.length > 0);
        const hasSpecificSkills = !!(skill_ids && skill_ids.length > 0);
        const inSpecificMode = hasSpecificTools || hasSpecificSkills;

        const fetchTools = (hasSpecificTools || (!inSpecificMode && (resource_type === 'all' || resource_type === 'tools'))) && !isNone;
        const fetchSkills = (hasSpecificSkills || (!inSpecificMode && (resource_type === 'all' || resource_type === 'skills'))) && !isNone;
        const fetchPendingTask = (!inSpecificMode && (resource_type === 'all' || resource_type === 'pending_task')) && !isNone;

        // -----------------------------------------------------------------------
        // Step 2: Check pending tasks for this thread
        // -----------------------------------------------------------------------
        let pendingTask = null;
        if (fetchPendingTask) {
            pendingTask = await getPendingTask(thread_id);
            if (pendingTask) {
                logger.info(`[API] Found pending task ${pendingTask.id} (AWAITING_INPUT) for thread ${thread_id}`);
            }
        }

        // -----------------------------------------------------------------------
        // Step 3: Prepare Identifiers
        // -----------------------------------------------------------------------

        // --- Prepare tool identifiers ---
        let toolIdsToFetch: string[] = [];
        if (fetchTools) {
            if (hasSpecificTools) {
                // If specific tools requested, only fetch those (filtered by auth whitelist)
                toolIdsToFetch = availableToolIds.filter(id => tool_ids.includes(id));
            } else {
                // Otherwise use all available whitelisted tools
                toolIdsToFetch = availableToolIds;
            }
        }

        // --- Prepare skill identifiers ---
        let skillIdsToFetch: string[] = [];
        if (fetchSkills) {
            if (hasSpecificSkills) {
                // If specific skills requested, only fetch those (filtered by auth whitelist)
                skillIdsToFetch = availableSkills.filter(id => skill_ids.includes(id));
            } else {
                // Otherwise use whitelisted skills, optionally filtered by category in Neo4j
                if (category) {
                    skillIdsToFetch = await neo4jClient.filterSkillsByCategory(availableSkills, category);
                } else {
                    skillIdsToFetch = availableSkills;
                }
            }
        }

        logger.info(`[API] Fetching: tools=${fetchTools} (ids: ${toolIdsToFetch.length}), skills=${fetchSkills} (ids: ${skillIdsToFetch.length})`);

        const [allToolGroups, skills, userProfile] = await Promise.all([
            fetchTools ? getGroupedToolsByIds(toolIdsToFetch) : Promise.resolve([]),
            fetchSkills ? getSkillsByIds(skillIdsToFetch) : Promise.resolve([]),
            getUserProfile(zalo_user_id),
        ]);

        let toolGroups = allToolGroups;
        if (tool_group) {
            toolGroups = allToolGroups.filter(tg => tg.key === tool_group);
        }

        const elapsed = Date.now() - startTime;
        let totalTools = 0;
        
        // Step 4: Format tools and fetch/format context-data into markdown strings
        for (const tg of toolGroups) {
            // Calculate total tools before converting to string
            const toolsArray = (tg.tools as ToolResult[]) || [];
            totalTools += toolsArray.length;

            // Format Tools to Markdown - Clean, verbose format for AI Agents
            tg.tools = toolsArray.length > 0
                ? toolsArray.map((t, idx) => {
                    let md = `### ${idx + 1}. Tool: ${t.name} (Key: \`${t.key}\`)\n` +
                    `- **UUID**: ${t.id}\n` +
                    `- **Description**: ${t.description || 'No description'}\n` +
                    `- **Parameters Schema**:\n\`\`\`json\n${JSON.stringify(t.input_schema, null, 2)}\n\`\`\``;
                    
                    if (t.output_schema) {
                        md += `\n- **Output Schema**:\n\`\`\`json\n${JSON.stringify(t.output_schema, null, 2)}\n\`\`\``;
                    }
                    return md;
                }).join('\n\n')
                : "";

            // Fetch and Format Context Data
            if (tg.id !== 'general') {
                try {
                    const groupData = await neo4jClient.getToolGroupDataForWorkspace(tg.key, workspaceId);
                    tg['context-data'] = groupData.length > 0 
                        ? groupData.map(d => `- **${d.key}**: ${d.value}`).join('\n')
                        : "";
                } catch (err) {
                    logger.error(`[API] Failed to fetch data for tool group ${tg.key} in workspace ${workspaceId}: ${err}`);
                    tg['context-data'] = "";
                }
            } else {
                tg['context-data'] = "";
            }
        }

        logger.info(
            `[API] auth-and-resources complete in ${elapsed}ms: ` +
            `workspace=${workspaceId}, tool_groups=${toolGroups.length}, tools=${totalTools}, skills=${skills.length}, ` +
            `pending=${pendingTask ? pendingTask.id : 'none'}`
        );

        return NextResponse.json(
            {
                success: true,
                data: {
                    workspace_id: workspaceId,
                    role,
                    user: userProfile,
                    pending_task: pendingTask,
                    tool_groups: toolGroups,
                    skills: fetchSkills ? skills : [],
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
