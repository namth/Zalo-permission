import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { SyncTransaction } from '@/services/sync.service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const txn = new SyncTransaction();
  try {
    const body = await req.json();
    const {
      key,
      name,
      description,
      target_url,
      transport = 'SSE',
      timeout_seconds = 15,
      default_auth_token,
      raw_config,
      selected_tools = [],
    } = body;

    logger.info(`[API] POST /api/mcp/import - importing MCP ToolGroup [${key}] with ${selected_tools.length} tools`);

    if (!key || !name || !target_url) {
      return NextResponse.json(
        { success: false, error: 'Thiếu thông tin bắt buộc: key, name hoặc target_url.' },
        { status: 400 }
      );
    }

    const sanitizedKey = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    await txn.begin();

    // 1. Tạo hoặc Cập nhật ToolGroup trong PostgreSQL
    const defaultAuthConfig = default_auth_token
      ? { token: default_auth_token.trim() }
      : {};

    const groupId = randomUUID();
    const groupResult = await txn.pgQuery(
      `INSERT INTO tool_groups (
        id, key, name, description, protocol_type, base_url, mcp_transport,
        mcp_raw_config, timeout_seconds, default_auth_config, status, is_active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, 'MCP', $5, $6, $7, $8, $9, 'active', true, NOW(), NOW())
      ON CONFLICT (key) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        protocol_type = 'MCP',
        base_url = EXCLUDED.base_url,
        mcp_transport = EXCLUDED.mcp_transport,
        mcp_raw_config = EXCLUDED.mcp_raw_config,
        timeout_seconds = EXCLUDED.timeout_seconds,
        default_auth_config = EXCLUDED.default_auth_config,
        updated_at = NOW()
      RETURNING id, key, name, description, protocol_type, base_url, status`,
      [
        groupId,
        sanitizedKey,
        name.trim(),
        description || null,
        target_url.trim(),
        transport,
        raw_config ? JSON.stringify(raw_config) : null,
        timeout_seconds,
        JSON.stringify(defaultAuthConfig),
      ]
    );

    const toolGroup = groupResult.rows[0];

    // 2. Đồng bộ ToolGroup vào Neo4j
    await txn.neo4jRun(
      `MERGE (tg:ToolGroup { key: $key })
       SET tg.id = $id,
           tg.name = $name,
           tg.protocol = 'MCP',
           tg.updated_at = timestamp()
       RETURN tg`,
      {
        id: toolGroup.id,
        key: toolGroup.key,
        name: toolGroup.name,
      }
    );

    // 3. Thêm các Tools được chọn
    const insertedTools: any[] = [];
    for (const tool of selected_tools) {
      const rawToolName = tool.name || tool.key;
      if (!rawToolName) continue;

      const toolKey = `${sanitizedKey}_${rawToolName.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
      const toolDescription = tool.description || `Tool ${rawToolName} from ${name}`;
      const schema = tool.parameters_schema || tool.inputSchema || { type: 'object', properties: {} };
      const toolId = randomUUID();

      const toolPgRes = await txn.pgQuery(
        `INSERT INTO tools (
          id, key, name, description, tool_group_id, method, path,
          parameters_schema, input_schema, status, is_active, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, 'POST'::"HttpMethod", '/call', $6, $6, 'active', true, NOW(), NOW())
        ON CONFLICT (key) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          tool_group_id = EXCLUDED.tool_group_id,
          parameters_schema = EXCLUDED.parameters_schema,
          input_schema = EXCLUDED.input_schema,
          updated_at = NOW()
        RETURNING id, key, name, description, tool_group_id`,
        [
          toolId,
          toolKey,
          rawToolName,
          toolDescription,
          toolGroup.id,
          JSON.stringify(schema),
        ]
      );

      const insertedTool = toolPgRes.rows[0];
      insertedTools.push(insertedTool);

      // Đồng bộ Tool và quan hệ CONTAINS vào Neo4j
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
          id: insertedTool.id,
          key: insertedTool.key,
          name: insertedTool.name,
          groupId: toolGroup.id,
        }
      );
    }

    await txn.commit();
    logger.info(`[API] POST /api/mcp/import - successfully imported ToolGroup ${toolGroup.id} with ${insertedTools.length} tools`);

    return NextResponse.json(
      {
        success: true,
        message: `Đã tích hợp thành công MCP Server [${name}] và ${insertedTools.length} công cụ.`,
        data: {
          tool_group: toolGroup,
          tools_count: insertedTools.length,
          tools: insertedTools,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    await txn.rollback();
    logger.error(`[API] POST /api/mcp/import error: ${error?.message || error}`);
    return NextResponse.json(
      { success: false, error: error?.message || 'Lỗi khi nhập MCP Server vào hệ thống' },
      { status: 500 }
    );
  }
}
