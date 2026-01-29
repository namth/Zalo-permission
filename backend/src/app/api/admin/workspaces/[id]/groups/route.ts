import { NextRequest, NextResponse } from 'next/server';
import { addZaloGroup, getWorkspaceZaloGroups } from '@/services/workspace.service';

/**
 * POST /api/admin/workspaces/:id/groups - Add Zalo group
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    if (!body.thread_id) {
      return NextResponse.json(
        { success: false, error: 'Missing thread_id' },
        { status: 400 }
      );
    }

    const group = await addZaloGroup(
      params.id,
      body.thread_id,
      body.name,
      body.created_by
    );

    return NextResponse.json({ success: true, data: group }, { status: 201 });
  } catch (error: any) {
    console.error('Error adding zalo group:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to add zalo group' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/workspaces/:id/groups - List Zalo groups
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = request.nextUrl;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const { groups, total } = await getWorkspaceZaloGroups(params.id, limit, offset);

    return NextResponse.json(
      {
        success: true,
        data: groups,
        pagination: { limit, offset, total, hasMore: offset + limit < total }
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error getting zalo groups:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get zalo groups' },
      { status: 500 }
    );
  }
}
