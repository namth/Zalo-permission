/**
 * /api/admin/skills/[id]
 * GET: Get skill by ID
 * PATCH: Update skill status
 * DELETE: Delete (archive) skill
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

export async function GET(
    _req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        const result = await query(
            `SELECT s.id, s.name, s.description, s.detail, s.is_shared,
              s.status, s.created_at, s.updated_at
       FROM skills s
       WHERE s.id = $1`,
            [params.id]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Skill not found' }, { status: 404 });
        }

        const skill = mapRowToSkill(result.rows[0]);
        const { neo4jClient } = await import('@/lib/neo4j');
        const relations = await neo4jClient.getSkillRelations(skill.id);
        skill.category = relations.category;
        skill.tools = relations.tools;


        return NextResponse.json({ success: true, data: skill }, { status: 200 });
    } catch (error) {
        logger.error(`GET /api/admin/skills/${params.id} error: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        const body = await req.json();
        const { name, description, detail, owner_id = null, workspace_id = null, is_shared = false, category, tools = [] } = body;

        const currentUser = await getCurrentUser(req);
        
        // Get existing skill (metadata only)
        const checkRes = await query('SELECT id FROM skills WHERE id = $1', [params.id]);
        if (checkRes.rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Skill not found' }, { status: 404 });
        }

        const targetOwnerId = owner_id || currentUser?.id;

        const result = await query(
            `UPDATE skills SET name = $1, description = $2, detail = $3, is_shared = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
            [name, description || null, detail || null, is_shared, params.id]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Skill not found' }, { status: 404 });
        }

        const skillId = params.id;
        const { neo4jClient } = await import('@/lib/neo4j');
        
        // Sync Skill node
        await neo4jClient.syncSkill(skillId, name);

        // Update ownership in Neo4j if owner provided or we have current user
        if (targetOwnerId) {
            const userRes = await query('SELECT zalo_id FROM user_profile WHERE id = $1', [targetOwnerId]);
            if (userRes.rows.length > 0) {
                await neo4jClient.createOwnershipRelationship(userRes.rows[0].zalo_id, skillId);
            }
        }

        // Update workspace relationship in Neo4j
        if (workspace_id) {
            await neo4jClient.createSharingRelationship(skillId, workspace_id);
        }
        
        if (tools && tools.length > 0) {
            await neo4jClient.linkToolsToSkill(skillId, tools);
        }
        
        if (typeof category === 'string' && category) {
            await neo4jClient.setSkillCategory(skillId, category);
        }
        // If category is null/empty, we might want to clear it, but setSkillCategory already handles it if we pass it

        const skill = mapRowToSkill(result.rows[0]);
        const relations = await neo4jClient.getSkillRelations(skill.id);
        skill.category = relations.category;
        skill.tools = relations.tools;

        return NextResponse.json({ success: true, data: skill }, { status: 200 });
    } catch (error) {
        logger.error(`PUT /api/admin/skills/${params.id} error: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        const body = await req.json();
        const { status } = body;

        const validStatuses = ['active', 'archived', 'disabled'];
        if (!status || !validStatuses.includes(status)) {
            return NextResponse.json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
        }

        const result = await query(
            `UPDATE skills SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
            [status, params.id]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Skill not found' }, { status: 404 });
        }

        const skill = mapRowToSkill(result.rows[0]);
        const { neo4jClient } = await import('@/lib/neo4j');
        const relations = await neo4jClient.getSkillRelations(skill.id);
        skill.category = relations.category;
        skill.tools = relations.tools;

        return NextResponse.json({ success: true, data: skill }, { status: 200 });
    } catch (error) {
        logger.error(`PATCH /api/admin/skills/${params.id} error: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        const result = await query(
            `DELETE FROM skills
       WHERE id = $1
       RETURNING id`,
            [params.id]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Skill not found' }, { status: 404 });
        }

        const { neo4jClient } = await import('@/lib/neo4j');
        await neo4jClient.deleteNode(params.id);

        return NextResponse.json({ success: true, message: 'Skill deleted' }, { status: 200 });
    } catch (error) {
        logger.error(`DELETE /api/admin/skills/${params.id} error: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
