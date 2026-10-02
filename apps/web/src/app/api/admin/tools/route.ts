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
    const groupId = req.nextUrl.searchParams.get('group_id') || req.nextUrl.searchParams.get('tool_group_id');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '100', 10);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0', 10);

    logger.info(`[API] GET /api/admin/tools - status: ${status || 'all'}, group: ${groupId || 'all'}, limit: ${limit}, offset: ${offset}`);

    const db = getDb();
    let query = `SELECT id, key, name, description, tool_group_id, method, path, 
                        parameters_schema, body_schema, response_schema, input_schema, output_schema, 
                        status, is_active, created_at, updated_at 
                 FROM tools`;
    const conditions: string[] = [];
    const params: any[] = [];

    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(status);
    }

    if (groupId) {
      conditions.push(`tool_group_id = $${params.length + 1}::uuid`);
      params.push(groupId);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    const countQuery = conditions.length > 0
      ? `SELECT COUNT(*) as total FROM tools WHERE ${conditions.join(' AND ')}`
      : `SELECT COUNT(*) as total FROM tools`;
    const countResult = await db.query(countQuery, params.slice(0, conditions.length));
    const total = parseInt(countResult.rows[0].total, 10);

    // Get group mapping from PostgreSQL tool_groups
    const pgGroupsRes = await db.query('SELECT id, key, name, protocol_type, base_url FROM tool_groups');
    const pgGroupMap = new Map<string, { id: string; key: string; name: string; protocol_type: string; base_url: string }>();
    for (const g of pgGroupsRes.rows) {
      pgGroupMap.set(String(g.id), {
        id: String(g.id),
        key: g.key,
        name: g.name,
        protocol_type: g.protocol_type || 'REST',
        base_url: g.base_url || '',
      });
    }

    // Get group mapping from Neo4j (both BELONGS_TO_GROUP and CONTAINS)
    const groupMap = new Map<string, { id: string; key: string; name: string }>();
    try {
      const neo4jRes = await neo4jClient.run(`
        MATCH (t:Tool)-[:BELONGS_TO_GROUP]->(tg:ToolGroup)
        RETURN t.id AS tool_id, tg.id AS group_id, tg.key AS group_key, tg.name AS group_name
        UNION
        MATCH (tg:ToolGroup)-[:CONTAINS]->(t:Tool)
        RETURN t.id AS tool_id, tg.id AS group_id, tg.key AS group_key, tg.name AS group_name
      `);
      
      for (const record of neo4jRes.records) {
        const toolId = record.get('tool_id');
        const rGroupId = record.get('group_id');
        
        if (toolId && rGroupId) {
          groupMap.set(String(toolId), {
            id: String(rGroupId),
            key: record.get('group_key'),
            name: record.get('group_name')
          });
        }
      }
    } catch (neoErr) {
      logger.warn(`Failed to fetch Neo4j tool group mappings: ${neoErr}`);
    }

    const data = result.rows.map((row: any) => {
      const rowId = String(row.id);
      const pgGroup = row.tool_group_id ? pgGroupMap.get(String(row.tool_group_id)) : null;
      const neo4jGroup = groupMap.get(rowId);
      const group_info = pgGroup || neo4jGroup || null;
      
      return {
        ...row,
        group_id: row.tool_group_id || group_info?.id || null,
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
    const { 
      key, 
      name, 
      description, 
      method, 
      path, 
      parameters_schema, 
      body_schema, 
      response_schema, 
      input_schema, 
      output_schema, 
      created_by, 
      group_id,
      status,
      is_active,
    } = body;

    logger.info(`[API] POST /api/admin/tools - tool: ${key}, group: ${group_id}, method: ${method}`);

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
      input_schema || parameters_schema,
      output_schema || response_schema,
      embedding,
      group_id,
      created_by,
      {
        method: method || null,
        path: path || null,
        parameters_schema: parameters_schema || input_schema || null,
        body_schema: body_schema || null,
        response_schema: response_schema || output_schema || null,
        status: status || 'active',
        is_active: is_active !== undefined ? is_active : (status ? status === 'active' : true),
      }
    );

    // Log audit
    const auditLogService = new AuditLogService(db);
    await auditLogService.createAuditLog({
      workspace_id: null,
      action_type: 'TOOL_CREATED',
      input_data: { key, name, method, path, group_id },
      output_data: { tool_id: tool.id },
      status: 'SUCCESS',
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
