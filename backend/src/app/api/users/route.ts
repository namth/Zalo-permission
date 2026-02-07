import { NextRequest, NextResponse } from 'next/server';
import { listUsers, createOrGetUser, CreateUserRequest } from '@/services/user.service';

/**
 * GET /api/users - List all users
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const { users, total } = await listUsers(limit, offset);

    return NextResponse.json(
      {
        success: true,
        data: { users, pagination: { limit, offset, total, hasMore: offset + limit < total } }
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error listing users:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list users' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users - Create a new user
 * Body: { zalo_id, full_name, email?, phone?, gender?, note?, created_by?, workspace_id? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.zalo_id || !body.full_name) {
      return NextResponse.json(
        { success: false, error: 'zalo_id and full_name are required' },
        { status: 400 }
      );
    }

    const createUserData: CreateUserRequest = {
      zalo_id: body.zalo_id,
      full_name: body.full_name,
      email: body.email,
      phone: body.phone,
      gender: body.gender,
      note: body.note
    };

    const user = await createOrGetUser(createUserData, body.workspace_id, body.created_by);

    return NextResponse.json(
      { success: true, data: user },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create user' },
      { status: 500 }
    );
  }
}
