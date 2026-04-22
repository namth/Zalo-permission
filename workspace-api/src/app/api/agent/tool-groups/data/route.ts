/**
 * POST /api/agent/tool-groups/data
 * 
 * Fetches Data nodes associated with both a ToolGroup and a Workspace.
 */

import { NextRequest, NextResponse } from 'next/server';
import { neo4jClient } from '@/lib/neo4j';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const body = await req.json();
        const { tool_group_id, workspace_id } = body;

        if (!tool_group_id || !workspace_id) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: tool_group_id, workspace_id' },
                { status: 400 }
            );
        }

        logger.info(`[API] Fetching data for tool group ${tool_group_id} in workspace ${workspace_id}`);

        const groupData = await neo4jClient.getToolGroupDataForWorkspace(tool_group_id, workspace_id);
        
        // Format to match agent/auth-and-resources: an array containing one object with all key-value pairs
        const formattedData = groupData.length > 0 
            ? [groupData.reduce((acc, d) => ({ ...acc, [d.key]: d.value }), {})]
            : [];

        return NextResponse.json(
            {
                success: true,
                data: formattedData,
            },
            { status: 200 }
        );
    } catch (error) {
        logger.error(`[API] POST /api/agent/tool-groups/data error: ${error}`);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
