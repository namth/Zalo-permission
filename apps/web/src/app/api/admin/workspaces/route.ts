/**
 * /api/admin/workspaces
 * 
 * Admin API for managing workspaces with synchronized PostgreSQL and Neo4j
 * GET: List all workspaces
 * POST: Create a new workspace (syncs to both databases)
 */

import { NextRequest, NextResponse } from 'next/server';
import { listWorkspaces } from '@/services/workspace.service';
import { WorkspaceSyncService } from '@/services/sync.service';
import { AuditLogService } from '@/services';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0', 10);

    logger.info(`[API] GET /api/admin/workspaces - user: ${user.id}, role: ${user.role}`);

    // Filter by user if not admin
    const filterByUserId = user.role !== 'admin' ? user.id : undefined;
    
    const { workspaces, total } = await listWorkspaces(limit, offset, filterByUserId);

    return NextResponse.json(
      {
        success: true,
        data: workspaces,
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
    logger.error(`[API] GET /api/admin/workspaces error: ${error}`);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, created_by } = body;

    logger.info(`[API] POST /api/admin/workspaces - user: ${user.id}, name: ${name}`);

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid required field: name',
        },
        { status: 400 }
      );
    }

    // Create workspace with full sync to PostgreSQL and Neo4j
    const workspace = await WorkspaceSyncService.createWorkspace(
      name.trim(),
      description?.trim() || undefined,
      created_by
    );

    logger.info(`[API] Workspace created with full sync: ${workspace.id}`);

    return NextResponse.json(
      {
        success: true,
        data: workspace,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error(`[API] POST /api/admin/workspaces error: ${error}`);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
