/**
 * /api/admin/tool-groups
 * GET: List all tool groups
 * POST: Create a new tool group (syncs to PostgreSQL + Neo4j)
 */

import { NextRequest, NextResponse } from 'next/server';
import { ToolGroupSyncService } from '@/services/sync.service';
import { getDb } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const status = req.nextUrl.searchParams.get('status');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '100', 10);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0', 10);

    logger.info(`[API] GET /api/admin/tool-groups - status: ${status || 'all'}`);

    const db = getDb();
    let queryStr = `SELECT id, key, name, description, status, created_at, updated_at FROM tool_groups`;
    const params: any[] = [];

    if (status) {
      queryStr += ` WHERE status = $1`;
      params.push(status);
    }

    queryStr += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(queryStr, params);
    const countResult = await db.query(
      status ? `SELECT COUNT(*) as total FROM tool_groups WHERE status = $1` : `SELECT COUNT(*) as total FROM tool_groups`,
      status ? [status] : []
    );
    const total = parseInt(countResult.rows[0].total, 10);

    return NextResponse.json({
      success: true,
      data: result.rows,
      pagination: { limit, offset, total, hasMore: offset + limit < total },
    }, { status: 200 });
  } catch (error) {
    logger.error(`[API] GET /api/admin/tool-groups error: ${error}`);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { key, name, description, created_by } = body;

    logger.info(`[API] POST /api/admin/tool-groups - key: ${key}`);

    if (!key || !name) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: key, name' },
        { status: 400 }
      );
    }

    // Validate key format (lowercase alphanumeric + underscore)
    if (!/^[a-z0-9_]+$/.test(key)) {
      return NextResponse.json(
        { success: false, error: 'Invalid key format. Must contain only lowercase letters, numbers, and underscores' },
        { status: 400 }
      );
    }

    // Check if key already exists
    const db = getDb();
    const existing = await db.query('SELECT id FROM tool_groups WHERE key = $1', [key]);
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: `Tool Group with key "${key}" already exists` },
        { status: 409 }
      );
    }

    const toolGroup = await ToolGroupSyncService.createToolGroup(key, name, description, created_by);

    logger.info(`[API] Tool Group created: ${toolGroup.id}`);
    return NextResponse.json({ success: true, data: toolGroup }, { status: 201 });
  } catch (error) {
    logger.error(`[API] POST /api/admin/tool-groups error: ${error}`);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
