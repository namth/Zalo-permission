/**
 * /api/admin/workspaces
 * 
 * Admin API for managing workspaces
 * GET: List all workspaces
 * POST: Create a new workspace
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0', 10);

    logger.info(`[API] GET /api/admin/workspaces - limit: ${limit}, offset: ${offset}`);

    const result = await db.query(
      `SELECT * FROM workspaces ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
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
    const { name, description } = body;

    logger.info(`[API] POST /api/admin/workspaces - name: ${name}`);

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: name',
        },
        { status: 400 }
      );
    }

    const result = await db.query(
      `INSERT INTO workspaces (name, description, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       RETURNING *`,
      [name, description || null]
    );

    logger.info(`[API] Workspace ${result.rows[0].id} created`);

    return NextResponse.json(
      {
        success: true,
        data: result.rows[0],
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
