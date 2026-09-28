/**
 * /api/admin/tools
 * 
 * Manage system tools/integrations with synchronized PostgreSQL and Neo4j
 * GET: List all tools
 * POST: Create a new tool (syncs to both databases)
 */

import { NextRequest, NextResponse } from 'next/server';
import { ToolSyncService } from '@/services/sync.service';
import { AuditLogService } from '@/services';
import { getDb } from '@/lib/db';
import { embeddingClient } from '@/lib/embedding';
import { logger } from '@/lib/logger';
import { neo4jClient } from '@/lib/neo4j';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const status = req.nextUrl.searchParams.get('status');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '100', 10);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0', 10);

    logger.info(`[API] GET /api/admin/tools - status: ${status || 'all'}, limit: ${limit}, offset: ${offset}`);

    const db = getDb();
    let query = `SELECT id, key, name, description, input_schema, output_schema, status, created_at, updated_at 
                 FROM tools`;
    const params: any[] = [];

    if (status) {
      query += ` WHERE status = $1`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    const countResult = await db.query(
      status ? `SELECT COUNT(*) as total FROM tools WHERE status = $1` : `SELECT COUNT(*) as total FROM tools`,
      status ? [status] : []
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Get group mapping from Neo4j
    const neo4jRes = await neo4jClient.run(`
      MATCH (t:Tool)-[:BELONGS_TO_GROUP]->(tg:ToolGroup)
      RETURN t.id AS tool_id, tg.id AS group_id, tg.key AS group_key, tg.name AS group_name
    `);
    
    const groupMap = new Map<string, { id: string; key: string; name: string }>();
    for (const record of neo4jRes.records) {
      const toolId = record.get('tool_id');
      const groupId = record.get('group_id');
      
      if (toolId && groupId) {
        groupMap.set(String(toolId), {
          id: String(groupId),
          key: record.get('group_key'),
          name: record.get('group_name')
        });
      }
    }

    const data = result.rows.map((row: any) => {
      const rowId = String(row.id);
      const group_info = groupMap.get(rowId) || null;
      
      return {
        ...row,
        group_info
      };
    });

    return NextResponse.json(
      {
        success: true,
        data,
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
    logger.error(`[API] GET /api/admin/tools error: ${error}`);

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
    const { key, name, description, input_schema, output_schema, created_by, group_id } = body;

    logger.info(`[API] POST /api/admin/tools - tool: ${key}, group: ${group_id}`);

    // Validation
    if (!key || !name) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: key, name',
        },
        { status: 400 }
      );
    }

    // Validate key format (lowercase alphanumeric + underscore)
    if (!/^[a-z0-9_]+$/.test(key)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid key format. Must contain only lowercase letters, numbers, and underscores',
        },
        { status: 400 }
      );
    }

    // Check if tool key already exists
    const db = getDb();
    const existing = await db.query(
      'SELECT id FROM tools WHERE key = $1',
      [key]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Tool with key "${key}" already exists`,
        },
        { status: 409 }
      );
    }

    // Generate embedding if description provided
    let embedding: number[] | undefined;
    if (description) {
      embedding = await embeddingClient.generateEmbedding(description);
    }

    // Create tool with full sync to PostgreSQL and Neo4j
    const tool = await ToolSyncService.createTool(
      key,
      name,
      description,
      input_schema,
      output_schema,
      embedding,
      group_id,
      created_by
    );

    // Log audit
    const auditLogService = new AuditLogService(db);
    await auditLogService.createAuditLog({
      workspace_id: null, // system-level action, no specific workspace
      action_type: 'TOOL_CREATED',
      input_data: { key, name },
      output_data: { tool_id: tool.id },
      status: 'success',
    });

    logger.info(`[API] Tool created with full sync: ${tool.id}`);

    return NextResponse.json(
      {
        success: true,
        data: tool,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error(`[API] POST /api/admin/tools error: ${error}`);

    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
