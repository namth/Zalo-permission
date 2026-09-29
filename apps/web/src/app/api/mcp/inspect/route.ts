import { NextRequest, NextResponse } from 'next/server';
import { McpConfigParser, McpToolExecutor } from '@omniagent/core';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { raw_config, endpoint_url, default_auth_token } = body;

    logger.info('[API] POST /api/mcp/inspect - inspecting MCP configuration');

    const inputToParse = raw_config || endpoint_url;
    if (!inputToParse) {
      return NextResponse.json(
        {
          success: false,
          error: 'Vui lòng cung cấp cấu hình JSON mcpServers hoặc URL endpoint của server MCP.',
        },
        { status: 400 }
      );
    }

    // 1. Bóc tách cấu hình
    const parsed = McpConfigParser.parse(inputToParse);

    // 2. Chuẩn bị Authentication Headers
    const authHeaders: Record<string, string> = {};
    if (parsed.headers) {
      Object.assign(authHeaders, parsed.headers);
    }
    if (default_auth_token && typeof default_auth_token === 'string' && default_auth_token.trim()) {
      const trimmed = default_auth_token.trim();
      authHeaders['Authorization'] = trimmed.startsWith('Bearer ') ? trimmed : `Bearer ${trimmed}`;
    }

    // 3. Kết nối lấy danh sách tools
    const tools = await McpToolExecutor.listTools({
      endpointUrl: parsed.targetUrl,
      authHeaders,
      timeoutMs: 15000,
    });

    logger.info(`[API] POST /api/mcp/inspect - successfully discovered ${tools.length} tools from ${parsed.targetUrl}`);

    return NextResponse.json({
      success: true,
      data: {
        server_name: parsed.serverName,
        target_url: parsed.targetUrl,
        transport: parsed.transport,
        tools,
        raw_config: parsed.rawSnippet || null,
      },
    });
  } catch (error: any) {
    logger.error(`[API] POST /api/mcp/inspect error: ${error?.message || error}`);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Không thể kết nối hoặc bóc tách công cụ từ MCP Server',
      },
      { status: 400 }
    );
  }
}
