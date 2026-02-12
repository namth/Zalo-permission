/**
 * /api/admin/workspaces/[id]/zalo-groups
 * 
 * Manage Zalo groups for a workspace
 * GET: List all Zalo groups linked to workspace
 * DELETE: Remove Zalo group from workspace
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const { id: workspaceId } = params;
    logger.info(`[API] GET /api/admin/workspaces/${workspaceId}/zalo-groups`);

    const result = await db.query(
      `SELECT * FROM zalo_groups WHERE workspace_id = $1 ORDER BY created_at DESC`,
      [workspaceId]
    );

    return NextResponse.json(
      {
        success: true,
        data: result.rows,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error(`[API] GET /api/admin/workspaces/[id]/zalo-groups error: ${error}`);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const { id: workspaceId } = params;
    const threadId = req.nextUrl.searchParams.get('thread_id');

    logger.info(
      `[API] DELETE /api/admin/workspaces/${workspaceId}/zalo-groups - thread_id: ${threadId}`
    );

    if (!threadId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required query parameter: thread_id',
        },
        { status: 400 }
      );
    }

    const result = await db.query(
      `DELETE FROM zalo_groups WHERE workspace_id = $1 AND thread_id = $2 RETURNING id`,
      [workspaceId, threadId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Zalo group not found',
        },
        { status: 404 }
      );
    }

    logger.info(`[API] Zalo group ${threadId} removed from workspace ${workspaceId}`);

    return NextResponse.json(
      {
        success: true,
        message: 'Zalo group removed successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error(`[API] DELETE /api/admin/workspaces/[id]/zalo-groups error: ${error}`);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
