/**
 * /api/admin/skills/[id]
 * GET: Get skill by ID
 * PATCH: Update skill status
 * DELETE: Delete (archive) skill
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function mapRowToSkill(row: any) {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        owner_id: row.owner_id,
        owner_name: row.owner_name || null,
        workspace_id: row.workspace_id,
        is_shared: row.is_shared,
        logic_config: Array.isArray(row.logic_config)
            ? row.logic_config
            : typeof row.logic_config === 'string' ? JSON.parse(row.logic_config) : row.logic_config,
        status: row.status,
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    };
}

export async function GET(
    _req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        const result = await query(
            `SELECT s.id, s.name, s.description, s.owner_id, s.workspace_id, s.is_shared,
              s.logic_config, s.status, s.created_at, s.updated_at,
              u.full_name as owner_name
       FROM skills s
       LEFT JOIN user_profile u ON s.owner_id = u.id
       WHERE s.id = $1`,
            [params.id]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Skill not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: mapRowToSkill(result.rows[0]) }, { status: 200 });
    } catch (error) {
        logger.error(`GET /api/admin/skills/${params.id} error: ${error}`);
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
       RETURNING id, name, description, owner_id, workspace_id, is_shared, logic_config, status, created_at, updated_at`,
            [status, params.id]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Skill not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: mapRowToSkill(result.rows[0]) }, { status: 200 });
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
            `UPDATE skills SET status = 'archived', updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
            [params.id]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Skill not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Skill archived' }, { status: 200 });
    } catch (error) {
        logger.error(`DELETE /api/admin/skills/${params.id} error: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
