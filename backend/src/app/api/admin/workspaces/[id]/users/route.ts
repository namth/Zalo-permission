import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceUsers } from '@/services/user.service';
import { assignUserRole, removeUserFromWorkspace } from '@/services/workspace.service';

/**
 * GET /api/admin/workspaces/:id/users - List workspace users
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = request.nextUrl;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const { users, total } = await getWorkspaceUsers(params.id, limit, offset);

    return NextResponse.json(
      {
        success: true,
        data: users,
        pagination: { limit, offset, total, hasMore: offset + limit < total }
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error getting workspace users:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get workspace users' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/workspaces/:id/users/:user_id - Remove user from workspace
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json().catch(() => ({}));
    const user_id = request.nextUrl.searchParams.get('user_id');

    if (!user_id) {
      return NextResponse.json(
        { success: false, error: 'Missing user_id' },
        { status: 400 }
      );
    }

    await removeUserFromWorkspace(params.id, user_id, body.deleted_by);

    return NextResponse.json(
      { success: true, message: 'User removed from workspace' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error removing user from workspace:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to remove user' },
      { status: 500 }
    );
  }
}
