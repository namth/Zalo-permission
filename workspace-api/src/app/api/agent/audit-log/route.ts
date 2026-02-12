/**
 * POST /api/agent/audit-log
 * 
 * Create audit log entries
 * Used by n8n agents to log their actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { AuditLogRequest, AuditLogResponse } from '@/types';
import { AuditLogService } from '@/services';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function POST(req: NextRequest): Promise<NextResponse<AuditLogResponse>> {
  try {
    const body: AuditLogRequest = await req.json();
    const { workspace_id, agent_role, action_type, status } = body;

    logger.info(
      `[API] POST /api/agent/audit-log - agent: ${agent_role}, action: ${action_type}, status: ${status}`
    );

    // Validation
    if (!workspace_id || !agent_role || !action_type || !status) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: workspace_id, agent_role, action_type, status',
        },
        { status: 400 }
      );
    }

    const validRoles = ['Planner', 'Worker', 'Observer'];
    if (!validRoles.includes(agent_role)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid agent_role. Must be one of: ${validRoles.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const validStatuses = ['success', 'failed', 'pending'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Initialize service
    const auditLogService = new AuditLogService(db);

    // Create audit log
    const log = await auditLogService.createAuditLog(body);

    const response: AuditLogResponse = {
      success: true,
      data: log,
    };

    logger.info(`[API] Audit log ${log.id} created`);

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    logger.error(`[API] POST /api/agent/audit-log error: ${error}`);

    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const workspaceId = req.nextUrl.searchParams.get('workspace_id');
    const threadId = req.nextUrl.searchParams.get('thread_id');
    const userId = req.nextUrl.searchParams.get('user_id');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '100', 10);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0', 10);

    logger.info(`[API] GET /api/agent/audit-log - workspace: ${workspaceId}, limit: ${limit}, offset: ${offset}`);

    if (!workspaceId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required query parameter: workspace_id',
        },
        { status: 400 }
      );
    }

    const auditLogService = new AuditLogService(db);
    let result;

    if (threadId) {
      result = await auditLogService.listAuditLogsByThread(threadId, limit, offset);
    } else if (userId) {
      result = await auditLogService.listAuditLogsByUser(userId, limit, offset);
    } else {
      result = await auditLogService.listAuditLogsByWorkspace(workspaceId, undefined, limit, offset);
    }

    return NextResponse.json(
      {
        success: true,
        logs: result.logs,
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
    logger.error(`[API] GET /api/agent/audit-log error: ${error}`);

    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
