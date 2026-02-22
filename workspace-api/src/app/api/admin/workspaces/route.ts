/**
 * /api/admin/workspaces
 * 
 * Admin API for managing workspaces with synchronized PostgreSQL and Neo4j
 * GET: List all workspaces
 * POST: Create a new workspace (syncs to both databases)
 */

import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceSyncService } from '@/services/sync.service';
import { AuditLogService } from '@/services';
import { getDb } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0', 10);

    logger.info(`[API] GET /api/admin/workspaces - limit: ${limit}, offset: ${offset}`);

    const db = getDb();
    const result = await db.query(
      `SELECT id, name, description, status, created_at, updated_at 
       FROM workspaces 
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const countResult = await db.query(`SELECT COUNT(*) as total FROM workspaces`);
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
    const body = await req.json();
    const { name, description, created_by } = body;

    logger.info(`[API] POST /api/admin/workspaces - name: ${name}`);

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
