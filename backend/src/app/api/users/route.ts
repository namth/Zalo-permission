import { NextRequest, NextResponse } from 'next/server';
import { listUsers } from '@/services/user.service';

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
