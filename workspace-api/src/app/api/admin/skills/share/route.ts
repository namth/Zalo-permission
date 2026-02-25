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
            `UPDATE skills SET is_shared = true, updated_at = NOW() WHERE id = $1
       RETURNING id, name, description, owner_id, workspace_id, is_shared, logic_config, status, created_at, updated_at`,
            [skill_id]
        );

        const updatedResult = await query(
            `SELECT s.*, u.full_name as owner_name FROM skills s LEFT JOIN user_profile u ON s.owner_id = u.id WHERE s.id = $1`,
            [skill_id]
        );

        const row = updatedResult.rows[0];
        const skill = {
            ...row,
            logic_config: Array.isArray(row.logic_config)
                ? row.logic_config
                : typeof row.logic_config === 'string' ? JSON.parse(row.logic_config) : row.logic_config,
            created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
            updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
        };

        return NextResponse.json({ success: true, data: skill }, { status: 200 });
    } catch (error) {
        logger.error(`POST /api/admin/skills/share error: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
