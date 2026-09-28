/**
 * GET /api/user/audit-logs
 * 
 * List audit logs visible to user
 * Users can see logs related to their activities and workspace
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { ListAuditLogsResponse } from '@/types';
import { AuditLogService } from '@/services';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(req: NextRequest): Promise<NextResponse<ListAuditLogsResponse>> {
  try {
    const userId = req.nextUrl.searchParams.get('user_id');
    const workspaceId = req.nextUrl.searchParams.get('workspace_id');
    const threadId = req.nextUrl.searchParams.get('thread_id');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '100', 10);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0', 10);
    const startDate = req.nextUrl.searchParams.get('start_date');
    const endDate = req.nextUrl.searchParams.get('end_date');

    logger.info(
      `[API] GET /api/user/audit-logs - user: ${userId}, workspace: ${workspaceId}, limit: ${limit}`
    );

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          logs: [],
          error: 'Missing required query parameter: user_id',
        },
        { status: 400 }
      );
    }

    // Initialize service
    const auditLogService = new AuditLogService(db);

    let result;

    if (threadId) {
      // List logs for a specific thread
      result = await auditLogService.listAuditLogsByThread(threadId, limit, offset);
    } else if (workspaceId) {
      // List logs for workspace with optional filters
      result = await auditLogService.listAuditLogsByWorkspace(
        workspaceId,
        {
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
        limit,
        offset
      );
    } else {
      // List logs for user
      result = await auditLogService.listAuditLogsByUser(userId, limit, offset);
    }

    const response: ListAuditLogsResponse = {
      success: true,
      logs: result.logs,
      pagination: {
        limit,
        offset,
        total: result.total,
        hasMore: offset + limit < result.total,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    logger.error(`[API] GET /api/user/audit-logs error: ${error}`);

    return NextResponse.json(
      {
        success: false,
        logs: [],
        error: String(error),
      },
      { status: 500 }
    );
  }
}
