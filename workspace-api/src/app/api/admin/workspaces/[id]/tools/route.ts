
import { NextRequest, NextResponse } from 'next/server';
import {
    getWorkspaceTools,
    addToolToWorkspace,
    removeToolFromWorkspace
} from '@/services/workspace.service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        const tools = await getWorkspaceTools(params.id);
        return NextResponse.json({ success: true, data: tools }, { status: 200 });
    } catch (error) {
        logger.error(`Error fetching workspace tools: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        const body = await req.json();
        const { tool_id } = body;

        if (!tool_id) {
            return NextResponse.json({ success: false, error: 'tool_id is required' }, { status: 400 });
        }

        await addToolToWorkspace(params.id, tool_id, 'admin'); // TODO: get user from session
        return NextResponse.json({ success: true, message: 'Tool added to workspace' }, { status: 201 });
    } catch (error) {
        logger.error(`Error adding tool to workspace: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        const body = await req.json();
        const { tool_id } = body; // Expecting tool_id in body for DELETE? Or query param? 
        // Usually DELETE relationship uses query param or body. Let's support body.

        if (!tool_id) {
            // Try query param
            const url = new URL(req.url);
            const qToolId = url.searchParams.get('tool_id');
            if (qToolId) {
                await removeToolFromWorkspace(params.id, qToolId, 'admin');
                return NextResponse.json({ success: true, message: 'Tool removed from workspace' }, { status: 200 });
            }
            return NextResponse.json({ success: false, error: 'tool_id is required' }, { status: 400 });
        }

        await removeToolFromWorkspace(params.id, tool_id, 'admin');
        return NextResponse.json({ success: true, message: 'Tool removed from workspace' }, { status: 200 });
    } catch (error) {
        logger.error(`Error removing tool from workspace: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
