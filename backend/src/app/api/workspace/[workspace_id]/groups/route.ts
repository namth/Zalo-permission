import { NextRequest, NextResponse } from 'next/server';
import { addZaloGroup, getWorkspaceZaloGroups } from '@/services/workspace.service';

/**
 * GET /api/workspace/:workspace_id/groups - List Zalo groups in a workspace
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { workspace_id: string } }
) {
  try {
    const workspaceId = params.workspace_id;
    const { searchParams } = request.nextUrl;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const { groups, total } = await getWorkspaceZaloGroups(workspaceId, limit, offset);

    return NextResponse.json(
      {
        success: true,
        data: { groups, pagination: { limit, offset, total, hasMore: offset + limit < total } }
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error listing zalo groups:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list zalo groups' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspace/:workspace_id/groups - Create and add Zalo group to workspace
 * Body: { thread_id, name?, created_by? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { workspace_id: string } }
) {
  try {
    const workspaceId = params.workspace_id;
    const body = await request.json();

    // Validate required fields
    if (!body.thread_id) {
      return NextResponse.json(
        { success: false, error: 'thread_id is required' },
        { status: 400 }
      );
    }

    const group = await addZaloGroup(
      workspaceId,
      body.thread_id,
      body.name,
      body.created_by
    );

    return NextResponse.json(
      { success: true, data: group },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating zalo group:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create zalo group' },
      { status: error.message?.includes('already') ? 409 : 500 }
    );
  }
}
