/**
 * /api/admin/workspaces/[id]/tool-groups/[toolId]/data
 * GET: List all Data nodes for a tool group scoped to this workspace
 * POST: Create a new Data node linked to both tool group and workspace
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { neo4jClient } from '@/lib/neo4j';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(
    _req: NextRequest,
    { params }: { params: { id: string; toolId: string } } // Wait, this route probably should be workspace/[id]/tool-groups/[groupId]/data? Refactoring the route path later, keep the params for now but query tool_groups. Let's assume toolId is group ID.
): Promise<NextResponse> {
    try {
        const workspaceId = params.id;
        const groupId = params.toolId;

        // Look up the group key from Postgres
        const result = await query(`SELECT key FROM tool_groups WHERE id = $1`, [groupId]);
        if (result.rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Tool Group not found' }, { status: 404 });
        }
        const groupKey = result.rows[0].key;

        const data = await neo4jClient.getToolGroupDataForWorkspace(groupKey, workspaceId);

        return NextResponse.json({ success: true, data }, { status: 200 });
    } catch (error) {
        logger.error(`GET /api/admin/workspaces/${params.id}/tools/${params.toolId}/data error: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string; toolId: string } } // Similarly, toolId is treated as groupId here.
): Promise<NextResponse> {
    try {
        const workspaceId = params.id;
        const groupId = params.toolId;
        const body = await req.json();
        const { key, value } = body;

        if (!key?.trim() || !value?.trim()) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: key, value' },
                { status: 400 }
            );
        }

        // Look up the group key from Postgres
        const result = await query(`SELECT key FROM tool_groups WHERE id = $1`, [groupId]);
        if (result.rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Tool Group not found' }, { status: 404 });
        }
        const groupKey = result.rows[0].key;

        const data = await neo4jClient.createToolGroupData(groupKey, key.trim(), value.trim(), workspaceId);

        logger.info(`[API] Created Data node for tool group ${groupId} in workspace ${workspaceId}: ${key}`);
        return NextResponse.json({ success: true, data }, { status: 201 });
    } catch (error) {
        logger.error(`POST /api/admin/workspaces/${params.id}/tools/${params.toolId}/data error: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
