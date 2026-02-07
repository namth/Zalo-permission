import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

interface StatsResponse {
  workspaces: number;
  users: number;
  agents: number;
  auditLogs: number;
}

/**
 * GET /api/admin/stats - Get dashboard statistics
 */
export async function GET(request: NextRequest) {
  try {
    const [workspacesRes, usersRes, agentsRes, auditLogsRes] =
      await Promise.all([
        query("SELECT COUNT(*) as count FROM workspaces"),
        query("SELECT COUNT(*) as count FROM user_profile"),
        query("SELECT COUNT(*) as count FROM agents"),
        query("SELECT COUNT(*) as count FROM audit_logs"),
      ]);

    const stats: StatsResponse = {
      workspaces: parseInt(workspacesRes.rows[0]?.count || "0"),
      users: parseInt(usersRes.rows[0]?.count || "0"),
      agents: parseInt(agentsRes.rows[0]?.count || "0"),
      auditLogs: parseInt(auditLogsRes.rows[0]?.count || "0"),
    };

    return NextResponse.json({ success: true, data: stats }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch stats" },
      { status: 500 },
    );
  }
}
