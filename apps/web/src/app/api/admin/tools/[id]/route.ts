/**
 * /api/admin/tools/[id]
 * GET: Get tool by ID
 * PUT: Update tool
 * DELETE: Delete tool
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';
import { neo4jClient } from '@/lib/neo4j';
import { ToolSyncService } from '@/services/sync.service';

export const dynamic = 'force-dynamic';

function mapRowToTool(row: any) {
    return {
        id: row.id,
        key: row.key,
        name: row.name,
        description: row.description,
        input_schema: row.input_schema && typeof row.input_schema === 'string'
            ? JSON.parse(row.input_schema)
            : row.input_schema,
        output_schema: row.output_schema && typeof row.output_schema === 'string'
            ? JSON.parse(row.output_schema)
            : row.output_schema,
        status: row.status,
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    };
}

export async function GET(
    _req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        const result = await query(
            `SELECT id, key, name, description, input_schema, output_schema, status, created_at, updated_at FROM tools WHERE id = $1`,
            [params.id]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Tool not found' }, { status: 404 });
        }

        // Fetch group info from Neo4j
        const neo4jRes = await neo4jClient.run(
            `MATCH (t:Tool {id: $id})-[:BELONGS_TO_GROUP]->(tg:ToolGroup) 
             RETURN tg.id AS id, tg.key AS key, tg.name AS name`,
            { id: params.id }
        );
        
        let group_info = null;
        let group_id = null;
        
        if (neo4jRes.records.length > 0) {
            const record = neo4jRes.records[0];
            group_info = {
                id: String(record.get('id')),
                key: record.get('key'),
                name: record.get('name')
            };
            group_id = group_info.id;
        }

        const tool: any = mapRowToTool(result.rows[0]);
        tool.group_id = group_id;
        tool.group_info = group_info;

        return NextResponse.json({ success: true, data: tool }, { status: 200 });
    } catch (error) {
        logger.error(`GET /api/admin/tools/${params.id} error: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        const body = await req.json();
        const { name, description, input_schema, output_schema, status, group_id } = body;

        const tool = await ToolSyncService.updateTool(params.id, {
            name,
            description,
            input_schema,
            output_schema,
            status,
            group_id,
        });

        // Add group_id to the response
        const mappedTool: any = mapRowToTool(tool);
        mappedTool.group_id = group_id;

        return NextResponse.json({ success: true, data: mappedTool }, { status: 200 });
    } catch (error) {
        logger.error(`PUT /api/admin/tools/${params.id} error: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        await ToolSyncService.deleteTool(params.id);
        return NextResponse.json({ success: true, message: 'Tool deleted' }, { status: 200 });
    } catch (error) {
        logger.error(`DELETE /api/admin/tools/${params.id} error: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
