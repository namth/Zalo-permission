/**
 * /api/admin/workspaces/[id]
 *
 * Admin API for managing individual workspaces with synchronized databases
 * GET: Get workspace details
 * PUT: Update workspace (syncs to both databases)
 * DELETE: Delete workspace (syncs to both databases)
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { WorkspaceSyncService } from "@/services/sync.service";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { UserService } from "@/services/user.service";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    
    // Check membership if not admin
    if (user.role !== 'admin') {
      const userRoleInWorkspace = await UserService.getUserRoleInWorkspace(id, user.id);
      if (!userRoleInWorkspace) {
        return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
      }
    }

    logger.info(`[API] GET /api/admin/workspaces/${id} - user: ${user.id}`);

    const db = getDb();
    const result = await db.query(
      `SELECT id, name, description, status, created_at, updated_at 
       FROM workspaces 
       WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Workspace not found",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result.rows[0],
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error(`[API] GET /api/admin/workspaces/[id] error: ${error}`);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();
    const { name, description, status, updated_by } = body;

    logger.info(`[API] PUT /api/admin/workspaces/${id} - user: ${user.id}`);

    // Build updates object with only provided fields
    const updates: any = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim();
    if (status !== undefined) updates.status = status;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No fields to update",
        },
        { status: 400 },
      );
    }

    // Update workspace with full sync to PostgreSQL and Neo4j
    const workspace = await WorkspaceSyncService.updateWorkspace(
      id,
      updates,
      updated_by
    );

    logger.info(`[API] Workspace ${id} updated with full sync`);

    return NextResponse.json(
      {
        success: true,
        data: workspace,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error(`[API] PUT /api/admin/workspaces/[id] error: ${error}`);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const { deleted_by } = body;

    logger.info(`[API] DELETE /api/admin/workspaces/${id} - user: ${user.id}`);

    // Delete workspace with full sync (cascade delete all related data)
    const workspace = await WorkspaceSyncService.deleteWorkspace(id, deleted_by);

    logger.info(
      `[API] Workspace ${id} deleted from both PostgreSQL and Neo4j`
    );

    return NextResponse.json(
      {
        success: true,
        message: "Workspace deleted successfully from both databases",
        data: workspace,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error(`[API] DELETE /api/admin/workspaces/[id] error: ${error}`);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 },
    );
  }
}
