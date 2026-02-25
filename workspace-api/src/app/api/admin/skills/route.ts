/**
 * /api/admin/skills
 * GET: List all skills with optional filters (workspace_id, owner_id, status)
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

        if (workspace_id) {
            conditions.push(`s.workspace_id = $${paramIndex++}`);
            params.push(workspace_id);
        }
        if (owner_id) {
            conditions.push(`s.owner_id = $${paramIndex++}`);
            params.push(owner_id);
        }
        if (status) {
            conditions.push(`s.status = $${paramIndex++}`);
            params.push(status);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const result = await query(
            `SELECT s.id, s.name, s.description, s.owner_id, s.workspace_id, s.is_shared,
              s.logic_config, s.status, s.created_at, s.updated_at,
              u.full_name as owner_name
       FROM skills s
       LEFT JOIN user_profile u ON s.owner_id = u.id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit, offset]
        );

        const countResult = await query(
            `SELECT COUNT(*) as count FROM skills s ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count, 10);

        return NextResponse.json({
            success: true,
            data: result.rows.map(mapRowToSkill),
            pagination: { limit, offset, total, hasMore: offset + limit < total },
        }, { status: 200 });
    } catch (error) {
        logger.error(`GET /api/admin/skills error: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
