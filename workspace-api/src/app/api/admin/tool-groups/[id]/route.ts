/**
 * /api/admin/tool-groups/[id]
 * GET: Get tool group by ID (with nested tools)
 * PUT: Update tool group
 * DELETE: Delete tool group
 */

import { NextRequest, NextResponse } from 'next/server';
import { ToolGroupSyncService } from '@/services/sync.service';
import { getDb } from '@/lib/db';
import { logger } from '@/lib/logger';
import { neo4jClient } from '@/lib/neo4j';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const { id } = params;
    const db = getDb();

    const groupResult = await db.query(
      `SELECT id, key, name, description, status, created_at, updated_at FROM tool_groups WHERE id = $1`,
      [id]
    );

    if (groupResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Tool Group not found' }, { status: 404 });
    }

    const group = groupResult.rows[0];

    // Fetch tools belonging to this group from Neo4j
    const neo4jRes = await neo4jClient.run(
      `MATCH (t:Tool)-[:BELONGS_TO_GROUP]->(tg:ToolGroup {id: $id}) RETURN t.id AS tool_id`,
      { id }
    );
    const toolIds = neo4jRes.records.map(r => r.get('tool_id'));

    let tools = [];
    if (toolIds.length > 0) {
      const toolsResult = await db.query(
        `SELECT id, key, name, description, input_schema, output_schema, status, created_at, updated_at
         FROM tools WHERE id = ANY($1) ORDER BY name ASC`,
        [toolIds]
      );
      tools = toolsResult.rows;
    }

    return NextResponse.json({
      success: true,
      data: { ...group, tools },
    }, { status: 200 });
  } catch (error) {
    logger.error(`[API] GET /api/admin/tool-groups/${params.id} error: ${error}`);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const { id } = params;
    const body = await req.json();
    const { name, description, status, updated_by } = body;

    logger.info(`[API] PUT /api/admin/tool-groups/${id}`);

    const toolGroup = await ToolGroupSyncService.updateToolGroup(
      id,
      { name, description, status },
      updated_by
    );

    return NextResponse.json({ success: true, data: toolGroup }, { status: 200 });
  } catch (error) {
    logger.error(`[API] PUT /api/admin/tool-groups/${params.id} error: ${error}`);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const { id } = params;
    logger.info(`[API] DELETE /api/admin/tool-groups/${id}`);

    const toolGroup = await ToolGroupSyncService.deleteToolGroup(id);

    return NextResponse.json({ success: true, data: toolGroup }, { status: 200 });
  } catch (error) {
    logger.error(`[API] DELETE /api/admin/tool-groups/${params.id} error: ${error}`);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
