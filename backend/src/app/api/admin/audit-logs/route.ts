import { NextRequest, NextResponse } from "next/server";
import {
  getAuditLogs,
  getAuditLogsForUser,
  getAllAuditLogs,
} from "@/services/audit.service";

/**
 * GET /api/admin/audit-logs - Get audit logs
 * ?workspace_id=... or ?user_id=... or no filter for all logs
 * ?action=... optional action filter
 * ?limit=50 (default 50, max 200)
 * ?offset=0 (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const workspace_id = searchParams.get("workspace_id");
    const user_id = searchParams.get("user_id");
    const action = searchParams.get("action");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const offset = parseInt(searchParams.get("offset") || "0");

    let result;
    if (workspace_id) {
      result = await getAuditLogs(workspace_id, limit, offset);
    } else if (user_id) {
      result = await getAuditLogsForUser(user_id, limit, offset);
    } else {
      // Get all audit logs with optional action filter
      result = await getAllAuditLogs(limit, offset, action || undefined);
    }

    return NextResponse.json(
      {
        success: true,
        data: result.logs,
        pagination: {
          limit,
          offset,
          total: result.total,
          hasMore: offset + limit < result.total,
        },
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Error getting audit logs:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Failed to get audit logs";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
