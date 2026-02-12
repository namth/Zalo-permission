/**
 * /api/admin/tools
 * 
 * Manage system tools/integrations
 * GET: List all tools
 * POST: Create a new tool
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { CreateToolRequest, CreateToolResponse, Tool } from '@/types';
import { ToolService, AuditLogService } from '@/services';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const status = req.nextUrl.searchParams.get('status');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '100', 10);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0', 10);

    logger.info(`[API] GET /api/admin/tools - status: ${status || 'all'}, limit: ${limit}, offset: ${offset}`);

    // Initialize service
    const toolService = new ToolService(db);

    // Get tools
    const result = await toolService.listTools(status || undefined, limit, offset);

    return NextResponse.json(
      {
        success: true,
        tools: result.tools,
        pagination: {
          limit,
          offset,
          total: result.total,
          hasMore: offset + limit < result.total,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error(`[API] GET /api/admin/tools error: ${error}`);

    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<CreateToolResponse>> {
  try {
    const body: CreateToolRequest = await req.json();
    const { key, name, description, input_schema } = body;

    logger.info(`[API] POST /api/admin/tools - tool: ${key}`);

    // Validation
    if (!key || !name) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: key, name',
        },
        { status: 400 }
      );
    }

    // Validate key format (lowercase alphanumeric + underscore)
    if (!/^[a-z0-9_]+$/.test(key)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid key format. Must contain only lowercase letters, numbers, and underscores',
        },
        { status: 400 }
      );
    }

    // Initialize services
    const toolService = new ToolService(db);
    const auditLogService = new AuditLogService(db);

    // Create tool
    const tool = await toolService.createTool({
      key,
      name,
      description,
      input_schema,
    });

    // Log audit
    await auditLogService.createAuditLog({
      workspace_id: 'system',
      agent_role: 'Observer',
      action_type: 'TOOL_CREATED',
      input_data: { key, name },
      output_data: { tool_id: tool.id },
      status: 'success',
    });

    const response: CreateToolResponse = {
      success: true,
      tool_id: tool.id,
    };

    logger.info(`[API] Tool ${tool.id} created`);

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    logger.error(`[API] POST /api/admin/tools error: ${error}`);

    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
