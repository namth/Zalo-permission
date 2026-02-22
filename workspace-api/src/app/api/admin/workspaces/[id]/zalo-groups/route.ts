/**
 * /api/admin/workspaces/[id]/zalo-groups
 * 
 * Manage Zalo groups for a workspace with synchronized databases
 * GET: List all Zalo groups linked to workspace
 * POST: Add a new Zalo group to workspace (syncs to both databases)
 * DELETE: Remove Zalo group from workspace (syncs to both databases)
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZaloGroupSyncService } from '@/services/sync.service';
import { getDb } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const { id: workspaceId } = params;
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '100', 10);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0', 10);

    logger.info(
      `[API] GET /api/admin/workspaces/${workspaceId}/zalo-groups - limit: ${limit}, offset: ${offset}`
    );

    const db = getDb();
    const result = await db.query(
      `SELECT id, workspace_id, thread_id, name, status, created_at, updated_at 
       FROM zalo_groups 
       WHERE workspace_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [workspaceId, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM zalo_groups WHERE workspace_id = $1`,
      [workspaceId]
    );
    const total = parseInt(countResult.rows[0].total, 10);

    return NextResponse.json(
      {
        success: true,
        data: result.rows,
        pagination: {
          limit,
          offset,
          total,
          hasMore: offset + limit < total,
        },
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

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const { id: workspaceId } = params;
    const body = await req.json();
    const { thread_id, name, created_by } = body;

    logger.info(
      `[API] POST /api/admin/workspaces/${workspaceId}/zalo-groups - thread_id: ${thread_id}`
    );

    // Validation
    if (!thread_id || thread_id.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid required field: thread_id',
        },
        { status: 400 }
      );
    }

    // Verify workspace exists
    const db = getDb();
    const wsCheck = await db.query(
      'SELECT id FROM workspaces WHERE id = $1',
      [workspaceId]
    );
    if (wsCheck.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Workspace ${workspaceId} not found`,
        },
        { status: 404 }
      );
    }

    // Create Zalo group with full sync
    const group = await ZaloGroupSyncService.createZaloGroup(
      workspaceId,
      thread_id.trim(),
      name?.trim(),
      created_by
    );

    logger.info(
      `[API] Zalo group created with full sync: ${group.id} in workspace ${workspaceId}`
    );

    return NextResponse.json(
      {
        success: true,
        data: group,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error(`[API] POST /api/admin/workspaces/[id]/zalo-groups error: ${error}`);
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
    const body = await req.json();
    const { thread_id, deleted_by } = body;

    logger.info(
      `[API] DELETE /api/admin/workspaces/${workspaceId}/zalo-groups - thread_id: ${thread_id}`
    );

    if (!thread_id || thread_id.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid required field: thread_id',
        },
        { status: 400 }
      );
    }

    // Get the zalo group first
    const db = getDb();
    const groupResult = await db.query(
      `SELECT id, workspace_id FROM zalo_groups 
       WHERE workspace_id = $1 AND thread_id = $2`,
      [workspaceId, thread_id.trim()]
    );

    if (groupResult.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Zalo group not found',
        },
        { status: 404 }
      );
    }

    const groupId = groupResult.rows[0].id;

    // Delete Zalo group with full sync
    const group = await ZaloGroupSyncService.deleteZaloGroup(groupId, deleted_by);

    logger.info(
      `[API] Zalo group deleted with full sync: ${groupId} from workspace ${workspaceId}`
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Zalo group removed successfully from both databases',
        data: group,
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
