/**
 * /api/admin/tool-groups/[id]/data
 * GET: List all Data nodes for a tool group
 * POST: Create a new Data node for a tool group
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { neo4jClient } from '@/lib/neo4j';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        const { searchParams } = new URL(req.url);
        const workspaceId = searchParams.get('workspaceId');

        // Look up the tool group key from Postgres using the id
        const result = await query(`SELECT key FROM tool_groups WHERE id = $1`, [params.id]);
        if (result.rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Tool Group not found' }, { status: 404 });
        }
        const groupKey = result.rows[0].key;

        let data;
        if (workspaceId) {
            data = await neo4jClient.getToolGroupDataForWorkspace(groupKey, workspaceId);
        } else {
            data = await neo4jClient.getToolGroupData(groupKey);
        }

        return NextResponse.json({ success: true, data }, { status: 200 });
    } catch (error) {
        logger.error(`GET /api/admin/tool-groups/${params.id}/data error: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        const body = await req.json();
        const { key, value, workspaceId } = body;

        if (!key?.trim() || !value?.trim()) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: key, value' },
                { status: 400 }
            );
        }

        // Look up the tool group key from Postgres
        const result = await query(`SELECT key FROM tool_groups WHERE id = $1`, [params.id]);
        if (result.rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Tool Group not found' }, { status: 404 });
        }
        const groupKey = result.rows[0].key;

        const data = await neo4jClient.createToolGroupData(groupKey, key.trim(), value.trim(), workspaceId);

        logger.info(`[API] Created Data node for tool group ${params.id}${workspaceId ? ` in workspace ${workspaceId}` : ''}: ${key}`);
        return NextResponse.json({ success: true, data }, { status: 201 });
    } catch (error) {
        logger.error(`POST /api/admin/tool-groups/${params.id}/data error: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
