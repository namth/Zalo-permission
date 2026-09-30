import { NextRequest, NextResponse } from 'next/server';
import {
    getWorkspaceTools,
    addToolToWorkspace,
    removeToolFromWorkspace
} from '@/services/workspace.service';
import { query, executeQuery } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        const tools = await getWorkspaceTools(params.id);
        return NextResponse.json({ success: true, data: tools }, { status: 200 });
    } catch (error) {
        logger.error(`Error fetching workspace tools: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        const body = await req.json();
        const { tool_id, tool_group_id } = body;

        // Xử lý bật/cấp quyền cho toàn bộ ToolGroup
        if (tool_group_id) {
            const toolsRes = await query('SELECT id, key, name FROM tools WHERE tool_group_id = $1', [tool_group_id]);
            for (const t of toolsRes.rows) {
                await addToolToWorkspace(params.id, t.id, undefined);
            }

            // Đồng bộ quan hệ CAN_USE với ToolGroup trong Neo4j
            const groupRes = await query('SELECT id, key, name FROM tool_groups WHERE id = $1', [tool_group_id]);
            if (groupRes.rows.length > 0) {
                try {
                    await executeQuery(
                        `MATCH (w:Workspace {id: $workspace_id})
                         MATCH (tg:ToolGroup) WHERE tg.id = $groupId OR tg.key = $groupKey
                         MERGE (w)-[:CAN_USE]->(tg)
                         RETURN w`,
                        { workspace_id: params.id, groupId: tool_group_id, groupKey: groupRes.rows[0].key }
                    );
                } catch (neoErr) {
                    logger.warn(`Failed to link ToolGroup in Neo4j: ${neoErr}`);
                }
            }

            return NextResponse.json({
                success: true,
                message: `Đã cấp quyền toàn bộ ${toolsRes.rows.length} công cụ thuộc nhóm cho Không gian làm việc`,
                count: toolsRes.rows.length,
            }, { status: 200 });
        }

        if (!tool_id) {
            return NextResponse.json({ success: false, error: 'tool_id hoặc tool_group_id là bắt buộc' }, { status: 400 });
        }

        await addToolToWorkspace(params.id, tool_id, undefined);
        return NextResponse.json({ success: true, message: 'Công cụ đã được gán vào Không gian làm việc' }, { status: 201 });
    } catch (error) {
        logger.error(`Error adding tool to workspace: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        let tool_id: string | null = null;
        let tool_group_id: string | null = null;
        
        try {
            const body = await req.json();
            tool_id = body.tool_id;
            tool_group_id = body.tool_group_id;
        } catch (e) {
            // Body might be empty or not JSON
        }

        if (!tool_id && !tool_group_id) {
            const url = new URL(req.url);
            tool_id = url.searchParams.get('tool_id');
            tool_group_id = url.searchParams.get('tool_group_id');
        }

        // Xử lý thu hồi quyền toàn bộ ToolGroup
        if (tool_group_id) {
            const toolsRes = await query('SELECT id, key, name FROM tools WHERE tool_group_id = $1', [tool_group_id]);
            for (const t of toolsRes.rows) {
                await removeToolFromWorkspace(params.id, t.id, undefined);
            }

            // Xóa quan hệ CAN_USE với ToolGroup trong Neo4j
            const groupRes = await query('SELECT id, key, name FROM tool_groups WHERE id = $1', [tool_group_id]);
            if (groupRes.rows.length > 0) {
                try {
                    await executeQuery(
                        `MATCH (w:Workspace {id: $workspace_id})-[r:CAN_USE]->(tg:ToolGroup)
                         WHERE tg.id = $groupId OR tg.key = $groupKey
                         DELETE r`,
                        { workspace_id: params.id, groupId: tool_group_id, groupKey: groupRes.rows[0].key }
                    );
                } catch (neoErr) {
                    logger.warn(`Failed to unlink ToolGroup in Neo4j: ${neoErr}`);
                }
            }

            return NextResponse.json({
                success: true,
                message: `Đã thu hồi toàn bộ ${toolsRes.rows.length} công cụ thuộc nhóm khỏi Không gian làm việc`,
                count: toolsRes.rows.length,
            }, { status: 200 });
        }

        if (!tool_id) {
            return NextResponse.json({ success: false, error: 'tool_id hoặc tool_group_id là bắt buộc' }, { status: 400 });
        }

        await removeToolFromWorkspace(params.id, tool_id, undefined);
        return NextResponse.json({ success: true, message: 'Công cụ đã được gỡ khỏi Không gian làm việc' }, { status: 200 });
    } catch (error) {
        logger.error(`Error removing tool from workspace: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
