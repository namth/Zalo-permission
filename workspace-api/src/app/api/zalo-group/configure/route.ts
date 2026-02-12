/**
 * POST /api/zalo-group/configure
 * 
 * Configure a Zalo group to link with a workspace
 * Input: thread_id (Zalo group ID), workspace_id
 * Creates record in zalo_groups table and Neo4j relationship
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { neo4jClient } from '@/lib/neo4j';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { thread_id, workspace_id, name } = body;

    logger.info(
      `[API] POST /api/zalo-group/configure - thread_id: ${thread_id}, workspace_id: ${workspace_id}`
    );

    if (!thread_id || !workspace_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: thread_id, workspace_id',
        },
        { status: 400 }
      );
    }

    // Check if workspace exists
    const workspaceCheck = await db.query(`SELECT id FROM workspaces WHERE id = $1`, [
      workspace_id,
    ]);

    if (workspaceCheck.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Workspace not found',
        },
        { status: 404 }
      );
    }

    // Insert or update zalo_group
    const result = await db.query(
      `INSERT INTO zalo_groups (thread_id, workspace_id, name, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (thread_id) DO UPDATE
       SET workspace_id = $2, name = COALESCE($3, zalo_groups.name), updated_at = NOW()
       RETURNING *`,
      [thread_id, workspace_id, name || null]
    );

    // Create Neo4j relationship: ZaloGroup -[:BELONGS_TO]-> Workspace
    await neo4jClient.createZaloGroupRelationship(thread_id, workspace_id);

    logger.info(`[API] Zalo group ${thread_id} configured with workspace ${workspace_id}`);

    return NextResponse.json(
      {
        success: true,
        data: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error(`[API] POST /api/zalo-group/configure error: ${error}`);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
