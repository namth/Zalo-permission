import { NextRequest, NextResponse } from 'next/server';
import { getUsersInZaloGroup } from '@/services/user.service';

/**
 * GET /api/workspace/groups/:group_id/users - List users in a Zalo group
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { group_id: string } }
) {
  try {
    const groupId = params.group_id;
    const { searchParams } = request.nextUrl;
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    const { users, total } = await getUsersInZaloGroup(groupId, limit, offset);

    return NextResponse.json(
      {
        success: true,
        data: {
          users,
          pagination: {
            limit,
            offset,
            total,
            hasMore: offset + limit < total
          }
        }
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error listing group users:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list group users' },
      { status: 500 }
    );
  }
}
