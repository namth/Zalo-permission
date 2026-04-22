/**
 * /api/admin/skills/share
 * POST: Share a skill with one or more workspaces
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const body = await req.json();
        const { skill_id, workspace_ids } = body;

        if (!skill_id) {
            return NextResponse.json({ success: false, error: 'skill_id is required' }, { status: 400 });
        }

        // Check skill exists
        const skillResult = await query(`SELECT id FROM skills WHERE id = $1`, [skill_id]);
        if (skillResult.rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Skill not found' }, { status: 404 });
        }

        // Mark skill as shared
        await query(
            `UPDATE skills SET is_shared = true, updated_at = NOW() WHERE id = $1`,
            [skill_id]
        );

        // Update Neo4j relationships
        const { neo4jClient } = await import('@/lib/neo4j');
        if (Array.isArray(workspace_ids) && workspace_ids.length > 0) {
            for (const workspaceId of workspace_ids) {
                await neo4jClient.createSharingRelationship(skill_id, workspaceId);
            }
        }

        const updatedResult = await query(
            `SELECT s.* FROM skills s WHERE s.id = $1`,
            [skill_id]
        );

        const row = updatedResult.rows[0];
        const skill = {
            id: row.id,
            name: row.name,
            description: row.description,
            is_shared: row.is_shared,
            detail: row.detail,
            status: row.status,
            created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
            updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
            category: null as string | null,
            tools: [] as {id: string, name: string}[]
        };

        // Populate details from Neo4j
        const relations = await neo4jClient.getSkillRelations(skill.id);
        skill.category = relations.category;
        skill.tools = relations.tools;

        return NextResponse.json({ success: true, data: skill }, { status: 200 });
    } catch (error) {
        logger.error(`POST /api/admin/skills/share error: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
