/**
 * /api/admin/skills
 * GET: List all skills with optional filters (workspace_id, owner_id, status)
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function mapRowToSkill(row: any) {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        is_shared: row.is_shared,
        detail: row.detail,
        status: row.status,
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
        category: null as string | null, // to be populated
        tools: [] as {id: string, name: string}[] // to be populated
    };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = req.nextUrl;
        const workspace_id = searchParams.get('workspace_id');
        const owner_id = searchParams.get('owner_id');
        const status = searchParams.get('status');
        const limit = parseInt(searchParams.get('limit') || '100', 10);
        const offset = parseInt(searchParams.get('offset') || '0', 10);

        const conditions: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        const { neo4jClient } = await import('@/lib/neo4j');

        // Handle filtering via Neo4j skill IDs if workspace_id or owner_id provided
        if (workspace_id || owner_id) {
            let ownerZaloId = null;
            if (owner_id) {
                const userRes = await query('SELECT zalo_id FROM user_profile WHERE id = $1', [owner_id]);
                ownerZaloId = userRes.rows[0]?.zalo_id;
            }

            const skillIds = await neo4jClient.getSkillIdsByFilter({ 
                workspace_id: workspace_id || undefined, 
                owner_zalo_id: ownerZaloId || undefined 
            });

            if (skillIds.length === 0) {
                return NextResponse.json({
                    success: true,
                    data: [],
                    pagination: { limit, offset, total: 0, hasMore: false },
                }, { status: 200 });
            }

            conditions.push(`s.id = ANY($${paramIndex++}::uuid[])`);
            params.push(skillIds);
        }

        if (status) {
            conditions.push(`s.status = $${paramIndex++}`);
            params.push(status);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const result = await query(
            `SELECT s.id, s.name, s.description, s.detail, s.is_shared,
              s.status, s.created_at, s.updated_at
       FROM skills s
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limit, offset]
        );

        const countResult = await query(
            `SELECT COUNT(*) as count FROM skills s ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count, 10);

        const skills = result.rows.map(mapRowToSkill);

        // Fetch Neo4j relationships for these skills
        if (skills.length > 0) {
            const { neo4jClient } = await import('@/lib/neo4j');
            for (const skill of skills) {
                const relations = await neo4jClient.getSkillRelations(skill.id);
                skill.category = relations.category;
                skill.tools = relations.tools;
            }
            
            // Filter by category if requested (in memory, since category is in Neo4j)
            const categoryFilter = searchParams.get('category');
            if (categoryFilter) {
                const filteredSkills = skills.filter(s => s.category === categoryFilter);
                return NextResponse.json({
                    success: true,
                    data: filteredSkills,
                    pagination: { limit, offset, total: filteredSkills.length, hasMore: false }, // pagination is inaccurate when filtering in memory
                }, { status: 200 });
            }
        }

        return NextResponse.json({
            success: true,
            data: skills,
            pagination: { limit, offset, total, hasMore: offset + limit < total },
        }, { status: 200 });
    } catch (error) {
        logger.error(`GET /api/admin/skills error: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const body = await req.json();
        const { name, description, detail, owner_id = null, workspace_id = null, is_shared = false, category, tools = [] } = body;

        if (!name) {
            return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
        }

        const currentUser = await getCurrentUser(req);
        const effectiveOwnerId = owner_id || currentUser?.id;

        if (!effectiveOwnerId) {
            return NextResponse.json({ success: false, error: 'Owner ID is required and could not be determined' }, { status: 400 });
        }

        // Insert into postgres (metadata only)
        const result = await query(
            `INSERT INTO skills (name, description, detail, is_shared, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING *`,
            [name, description || null, detail || null, is_shared]
        );

        const skillId = result.rows[0].id;

        // Update Neo4j relationships
        const { neo4jClient } = await import('@/lib/neo4j');
        
        // Ensure Skill node exists
        await neo4jClient.syncSkill(skillId, name);
        
        // Link Owner directly if owner_id exists
        if (effectiveOwnerId) {
            // we assume owner_id here is user internal uuid or zalo_id
            // In Neo4j, owner might be matched by zalo_id or id. 
            // The createOwnershipRelationship currently uses zalo_id.
            // Let's check the user profile to get zalo_id if needed.
            const userRes = await query('SELECT zalo_id FROM user_profile WHERE id = $1', [effectiveOwnerId]);
            if (userRes.rows.length > 0) {
                await neo4jClient.createOwnershipRelationship(userRes.rows[0].zalo_id, skillId);
            }
        }
        
        // Link tools
        if (tools && tools.length > 0) {
            await neo4jClient.linkToolsToSkill(skillId, tools);
        }
        
        // Set category
        if (category) {
            await neo4jClient.setSkillCategory(skillId, category);
        }

        // Link Workspace
        if (workspace_id) {
            await neo4jClient.createSharingRelationship(skillId, workspace_id);
        }

        const skill = mapRowToSkill(result.rows[0]);
        const relations = await neo4jClient.getSkillRelations(skill.id);
        skill.category = relations.category;
        skill.tools = relations.tools;

        return NextResponse.json({
            success: true,
            data: skill
        }, { status: 201 });
    } catch (error) {
        logger.error(`POST /api/admin/skills error: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
