
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

        await addToolToWorkspace(params.id, tool_id, undefined); // TODO: replace with actual user_id from session
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
        let tool_id: string | null = null;
        
        try {
            const body = await req.json();
            tool_id = body.tool_id;
        } catch (e) {
            // Body might be empty or not JSON
        }

        if (!tool_id) {
            const url = new URL(req.url);
            tool_id = url.searchParams.get('tool_id');
        }

        if (!tool_id) {
            return NextResponse.json({ success: false, error: 'tool_id is required' }, { status: 400 });
        }

        await removeToolFromWorkspace(params.id, tool_id, undefined);
        return NextResponse.json({ success: true, message: 'Tool removed from workspace' }, { status: 200 });
    } catch (error) {
        logger.error(`Error removing tool from workspace: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
