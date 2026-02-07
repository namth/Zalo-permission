import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * GET /api/admin/workspaces/:id/agent - Get groups with agents in workspace
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workspaceId = params.id;

    // Get all groups in workspace with their agents
    const result = await query(
      `SELECT id, agent_key, name FROM zalo_groups 
       WHERE workspace_id = $1 AND agent_key IS NOT NULL
       ORDER BY updated_at DESC`,
      [workspaceId]
    );

    return NextResponse.json(
      { success: true, data: result.rows },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error getting workspace groups with agents:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get groups' },
      { status: 500 }
    );
  }
}
