import { NextRequest, NextResponse } from 'next/server';
import { SyncTransaction } from '@/services/sync.service';
import { McpToolExecutor } from '@omniagent/core';
import { getDb } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const { id } = params;
  const db = getDb();

  logger.info(`[API] POST /api/tool-groups/${id}/mcp/sync - starting on-demand sync`);

  // 1. Lấy thông tin ToolGroup
  const groupRes = await db.query(
    `SELECT id, key, name, base_url, protocol_type, default_auth_config, timeout_seconds FROM tool_groups WHERE id = $1`,
    [id]
  );

  if (groupRes.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Không tìm thấy ToolGroup' }, { status: 404 });
  }

  const toolGroup = groupRes.rows[0];

  if (toolGroup.protocol_type !== 'MCP') {
    return NextResponse.json(
      { success: false, error: 'Chỉ có thể đồng bộ từ remote server đối với ToolGroup loại MCP' },
      { status: 400 }
    );
  }

  if (!toolGroup.base_url) {
    return NextResponse.json(
      { success: false, error: 'ToolGroup thiếu URL endpoint của MCP server' },
      { status: 400 }
    );
  }

  // 2. Chuẩn bị Authentication Headers
  const authHeaders: Record<string, string> = {};
  const authConfig = toolGroup.default_auth_config || {};
  if (authConfig.token) {
    const token = String(authConfig.token).trim();
    authHeaders['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }

  // 3. Gọi server MCP lấy danh sách tools mới nhất
  let latestTools: any[] = [];
  try {
    latestTools = await McpToolExecutor.listTools({
      endpointUrl: toolGroup.base_url,
      authHeaders,
      timeoutMs: (toolGroup.timeout_seconds || 15) * 1000,
    });
  } catch (err: any) {
    logger.error(`[API] MCP Sync failed to list tools: ${err.message}`);
    return NextResponse.json(
      { success: false, error: `Không thể kết nối tới MCP Server: ${err.message}` },
      { status: 502 }
    );
  }

  // 4. Đồng bộ vào CSDL
  const txn = new SyncTransaction();
  try {
    await txn.begin();

    let addedCount = 0;
    let updatedCount = 0;

    for (const tool of latestTools) {
      const rawToolName = tool.name;
      if (!rawToolName) continue;

      const toolKey = `${toolGroup.key}_${rawToolName.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
      const toolDescription = tool.description || `Tool ${rawToolName} from ${toolGroup.name}`;
      const schema = tool.inputSchema || tool.parameters_schema || { type: 'object', properties: {} };

      // Kiểm tra tool đã tồn tại chưa
      const checkRes = await txn.pgQuery('SELECT id FROM tools WHERE key = $1', [toolKey]);

      if (checkRes.rows.length === 0) {
        // Thêm mới
        const insertRes = await txn.pgQuery(
          `INSERT INTO tools (
            key, name, description, tool_group_id, method, path,
            parameters_schema, input_schema, status, is_active, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, 'POST', '/call', $5, $5, 'active', true, NOW(), NOW())
          RETURNING id, key, name`,
          [toolKey, rawToolName, toolDescription, toolGroup.id, JSON.stringify(schema)]
        );

        const newTool = insertRes.rows[0];
        addedCount++;

        // Sync Neo4j
        await txn.neo4jRun(
          `MERGE (t:Tool { key: $key })
           SET t.id = $id,
               t.name = $name,
               t.updated_at = timestamp()
           WITH t
           MATCH (tg:ToolGroup { id: $groupId })
           MERGE (tg)-[:CONTAINS]->(t)
           RETURN t`,
          {
            id: newTool.id,
            key: newTool.key,
            name: newTool.name,
            groupId: toolGroup.id,
          }
        );
      } else {
        // Cập nhật schema & description
        await txn.pgQuery(
          `UPDATE tools SET
            name = $1,
            description = $2,
            parameters_schema = $3,
            input_schema = $3,
            updated_at = NOW()
          WHERE key = $4`,
          [rawToolName, toolDescription, JSON.stringify(schema), toolKey]
        );
        updatedCount++;
      }
    }

    // Cập nhật updated_at cho ToolGroup
    await txn.pgQuery(`UPDATE tool_groups SET updated_at = NOW() WHERE id = $1`, [toolGroup.id]);

    await txn.commit();
    logger.info(`[API] MCP Sync completed for ${toolGroup.key}: +${addedCount} new, ${updatedCount} updated`);

    return NextResponse.json({
      success: true,
      message: `Đồng bộ thành công! Tìm thấy ${latestTools.length} công cụ (+${addedCount} mới, ${updatedCount} cập nhật).`,
      data: {
        total_tools: latestTools.length,
        added_tools: addedCount,
        updated_tools: updatedCount,
      },
    });
  } catch (error: any) {
    await txn.rollback();
    logger.error(`[API] MCP Sync transaction error: ${error?.message || error}`);
    return NextResponse.json(
      { success: false, error: error?.message || 'Lỗi khi cập nhật dữ liệu đồng bộ' },
      { status: 500 }
    );
  }
}
