/**
 * /api/admin/tools/[id]
 * GET: Get tool by ID
 * PUT: Update tool
 * DELETE: Delete tool
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

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
            `SELECT id, key, name, description, input_schema, status, created_at, updated_at FROM tools WHERE id = $1`,
            [params.id]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Tool not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: mapRowToTool(result.rows[0]) }, { status: 200 });
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
        const { name, description, input_schema, status } = body;

        const fields: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(name); }
        if (description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(description); }
        if (input_schema !== undefined) { fields.push(`input_schema = $${paramIndex++}`); values.push(input_schema ? JSON.stringify(input_schema) : null); }
        if (status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(status); }

        if (fields.length === 0) {
            const result = await query(`SELECT id, key, name, description, input_schema, status, created_at, updated_at FROM tools WHERE id = $1`, [params.id]);
            if (result.rows.length === 0) return NextResponse.json({ success: false, error: 'Tool not found' }, { status: 404 });
            return NextResponse.json({ success: true, data: mapRowToTool(result.rows[0]) });
        }

        fields.push(`updated_at = NOW()`);
        values.push(params.id);

        const result = await query(
            `UPDATE tools SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING id, key, name, description, input_schema, status, created_at, updated_at`,
            values
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Tool not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: mapRowToTool(result.rows[0]) }, { status: 200 });
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
        const check = await query(`SELECT id FROM tools WHERE id = $1`, [params.id]);
        if (check.rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Tool not found' }, { status: 404 });
        }

        await query(`DELETE FROM tools WHERE id = $1`, [params.id]);

        return NextResponse.json({ success: true, message: 'Tool deleted' }, { status: 200 });
    } catch (error) {
        logger.error(`DELETE /api/admin/tools/${params.id} error: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
