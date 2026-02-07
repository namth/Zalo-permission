import { NextRequest, NextResponse } from 'next/server';
import { getUserById, updateUser, deleteUser } from '@/services/user.service';

/**
 * GET /api/users/:id - Get user by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;
    const user = await getUserById(userId);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, data: user },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error getting user:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get user' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/users/:id - Update user profile
 * Body: { full_name?, email?, phone?, gender?, note?, status?, deleted_by?, workspace_id? }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;
    const body = await request.json();

    const updates = {
      full_name: body.full_name,
      email: body.email,
      phone: body.phone,
      gender: body.gender,
      note: body.note,
      status: body.status
    };

    // Remove undefined fields
    Object.keys(updates).forEach(key => updates[key as keyof typeof updates] === undefined && delete updates[key as keyof typeof updates]);

    const user = await updateUser(userId, updates, body.workspace_id, body.updated_by);

    return NextResponse.json(
      { success: true, data: user },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update user' },
      { status: error.message?.includes('not found') ? 404 : 500 }
    );
  }
}

/**
 * DELETE /api/users/:id - Delete user
 * Body: { deleted_by?, workspace_id? }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;
    const body = await request.json().catch(() => ({}));

    await deleteUser(userId, body.workspace_id, body.deleted_by);

    return NextResponse.json(
      { success: true, message: `User ${userId} deleted successfully` },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete user' },
      { status: error.message?.includes('not found') ? 404 : 500 }
    );
  }
}
