import { NextRequest, NextResponse } from 'next/server';
import { getAuditLogs, getAuditLogsForUser } from '@/services/audit.service';

/**
 * GET /api/admin/audit-logs - Get audit logs
 * ?workspace_id=... or ?user_id=...
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const workspace_id = searchParams.get('workspace_id');
    const user_id = searchParams.get('user_id');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!workspace_id && !user_id) {
      return NextResponse.json(
        { success: false, error: 'Missing workspace_id or user_id' },
        { status: 400 }
      );
    }

    let result;
    if (workspace_id) {
      result = await getAuditLogs(workspace_id, limit, offset);
    } else {
      result = await getAuditLogsForUser(user_id!, limit, offset);
    }

    return NextResponse.json(
      {
        success: true,
        data: result.logs,
        pagination: { limit, offset, total: result.total, hasMore: offset + limit < result.total }
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error getting audit logs:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get audit logs' },
      { status: 500 }
    );
  }
}
