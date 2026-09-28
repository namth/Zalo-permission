/**
 * /api/admin/tool-groups/[id]/data/[dataId]
 * PUT: Update a Data node
 * DELETE: Delete a Data node
 */

import { NextRequest, NextResponse } from 'next/server';
import { neo4jClient } from '@/lib/neo4j';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string; dataId: string } }
): Promise<NextResponse> {
    try {
        const body = await req.json();
        const { key, value } = body;

        if (!key?.trim() || !value?.trim()) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: key, value' },
                { status: 400 }
            );
        }

        const data = await neo4jClient.updateToolData(params.dataId, key.trim(), value.trim());

        logger.info(`[API] Updated Data node ${params.dataId}`);
        return NextResponse.json({ success: true, data }, { status: 200 });
    } catch (error) {
        logger.error(`PUT /api/admin/tool-groups/${params.id}/data/${params.dataId} error: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: { id: string; dataId: string } }
): Promise<NextResponse> {
    try {
        await neo4jClient.deleteToolData(params.dataId);

        logger.info(`[API] Deleted Data node ${params.dataId}`);
        return NextResponse.json({ success: true, message: 'Data deleted' }, { status: 200 });
    } catch (error) {
        logger.error(`DELETE /api/admin/tool-groups/${params.id}/data/${params.dataId} error: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
