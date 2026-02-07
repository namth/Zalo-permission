import { NextRequest, NextResponse } from 'next/server';
import { addUserToZaloGroup, removeUserFromZaloGroup } from '@/services/user.service';

/**
 * POST /api/workspace/groups/:group_id/user - Add user to a Zalo group
 * Body: { user_id, workspace_id?, created_by? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { group_id: string } }
) {
  try {
    const groupId = params.group_id;
    const body = await request.json();

    // Validate required fields
    if (!body.user_id) {
      return NextResponse.json(
        { success: false, error: 'user_id is required' },
        { status: 400 }
      );
    }

    const result = await addUserToZaloGroup(
      body.user_id,
      groupId,
      body.workspace_id,
      body.created_by
    );

    return NextResponse.json(
      { success: true, data: result },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error adding user to group:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to add user to group' },
      { status: error.message?.includes('not found') ? 404 : 500 }
    );
  }
}

/**
 * DELETE /api/workspace/groups/:group_id/user - Remove user from a Zalo group
 * Body: { user_id, workspace_id?, deleted_by? }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { group_id: string } }
) {
  try {
    const groupId = params.group_id;
    const body = await request.json();

    // Validate required fields
    if (!body.user_id) {
      return NextResponse.json(
        { success: false, error: 'user_id is required' },
        { status: 400 }
      );
    }

    const result = await removeUserFromZaloGroup(
      body.user_id,
      groupId,
      body.workspace_id,
      body.deleted_by
    );

    return NextResponse.json(
      { success: true, data: result },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error removing user from group:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to remove user from group' },
      { status: error.message?.includes('not found') ? 404 : 500 }
    );
  }
}
