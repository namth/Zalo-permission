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
        tool_group_id: row.tool_group_id,
        method: row.method || null,
        path: row.path || null,
        parameters_schema: row.parameters_schema && typeof row.parameters_schema === 'string'
            ? JSON.parse(row.parameters_schema)
            : row.parameters_schema || null,
        body_schema: row.body_schema && typeof row.body_schema === 'string'
            ? JSON.parse(row.body_schema)
            : row.body_schema || null,
        response_schema: row.response_schema && typeof row.response_schema === 'string'
            ? JSON.parse(row.response_schema)
            : row.response_schema || null,
        input_schema: row.input_schema && typeof row.input_schema === 'string'
            ? JSON.parse(row.input_schema)
            : row.input_schema || null,
        output_schema: row.output_schema && typeof row.output_schema === 'string'
            ? JSON.parse(row.output_schema)
            : row.output_schema || null,
        status: row.status,
        is_active: row.is_active !== undefined ? row.is_active : row.status === 'active',
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
            `SELECT t.id, t.key, t.name, t.description, t.tool_group_id, t.method, t.path, 
                    t.parameters_schema, t.body_schema, t.response_schema, t.input_schema, t.output_schema, 
                    t.status, t.is_active, t.created_at, t.updated_at,
                    tg.name as group_name, tg.key as group_key, tg.protocol_type, tg.base_url
             FROM tools t
             LEFT JOIN tool_groups tg ON t.tool_group_id = tg.id
             WHERE t.id = $1`,
            [params.id]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Tool not found' }, { status: 404 });
        }

        const row = result.rows[0];
        let group_info: any = null;
        let group_id = row.tool_group_id;

        if (row.tool_group_id) {
            group_info = {
                id: String(row.tool_group_id),
                key: row.group_key,
                name: row.group_name,
                protocol_type: row.protocol_type || 'REST',
                base_url: row.base_url || '',
            };
        } else {
            // Fallback check in Neo4j if not linked in Postgres
            try {
                const neo4jRes = await neo4jClient.run(
                    `MATCH (t:Tool {id: $id})-[:BELONGS_TO_GROUP]->(tg:ToolGroup) 
                     RETURN tg.id AS id, tg.key AS key, tg.name AS name`,
                    { id: params.id }
                );
                if (neo4jRes.records.length > 0) {
                    const record = neo4jRes.records[0];
                    group_info = {
                        id: String(record.get('id')),
                        key: record.get('key'),
                        name: record.get('name'),
                        protocol_type: 'REST',
                        base_url: '',
                    };
                    group_id = group_info.id;
                }
            } catch (neoErr) {
                logger.warn(`Neo4j group check failed: ${neoErr}`);
            }
        }

        const tool: any = mapRowToTool(row);
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
        const { 
            name, 
            description, 
            method,
            path,
            parameters_schema,
            body_schema,
            response_schema,
            input_schema, 
            output_schema, 
            status, 
            is_active,
            group_id 
        } = body;

        const tool = await ToolSyncService.updateTool(params.id, {
            name,
            description,
            method: method || null,
            path: path || null,
            parameters_schema: parameters_schema || input_schema || null,
            body_schema: body_schema || null,
            response_schema: response_schema || output_schema || null,
            input_schema: input_schema || parameters_schema || null,
            output_schema: output_schema || response_schema || null,
            status,
            is_active,
            group_id,
        });

        const mappedTool: any = mapRowToTool(tool);
        mappedTool.group_id = group_id || mappedTool.tool_group_id;

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
