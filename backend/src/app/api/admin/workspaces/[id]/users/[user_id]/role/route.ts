import { NextRequest, NextResponse } from 'next/server';
import { assignUserRole } from '@/services/workspace.service';

/**
 * PUT /api/admin/workspaces/:id/users/:user_id/role - Update user role
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; user_id: string } }
) {
  try {
    const body = await request.json();

    if (!body.role) {
      return NextResponse.json(
        { success: false, error: 'Missing role' },
        { status: 400 }
      );
    }

    const userRole = await assignUserRole(
      params.id,
      params.user_id,
      body.role,
      body.assigned_by
    );

    return NextResponse.json({ success: true, data: userRole }, { status: 200 });
  } catch (error: any) {
    console.error('Error updating user role:', error);

    if (error.message.includes('Invalid role')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update user role' },
      { status: 500 }
    );
  }
}
