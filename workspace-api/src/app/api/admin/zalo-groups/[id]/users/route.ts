
import { NextRequest, NextResponse } from 'next/server';
import { ZaloGroupService } from '@/services/zalo-group.service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// GET /api/admin/zalo-groups/[id]/users
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        const limit = parseInt(req.nextUrl.searchParams.get('limit') || '100', 10);
        const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0', 10);

        const { members, total } = await ZaloGroupService.getGroupUsers(params.id, limit, offset);

        return NextResponse.json({
            success: true,
            data: members,
            pagination: { limit, offset, total }
        }, { status: 200 });
    } catch (error) {
        logger.error(`Error fetching zalo group users: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

// POST /api/admin/zalo-groups/[id]/users
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        const body = await req.json();
        const { user_id, role } = body;

        if (!user_id) {
            return NextResponse.json({ success: false, error: 'user_id is required' }, { status: 400 });
        }

        const member = await ZaloGroupService.addUserToGroup(params.id, user_id, role || 'MEMBER', 'admin');
        return NextResponse.json({ success: true, data: member }, { status: 201 });
    } catch (error) {
        logger.error(`Error adding user to zalo group: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

// DELETE /api/admin/zalo-groups/[id]/users?user_id=...
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        const url = new URL(req.url);
        const user_id = url.searchParams.get('user_id');

        if (!user_id) {
            return NextResponse.json({ success: false, error: 'user_id is required' }, { status: 400 });
        }

        await ZaloGroupService.removeUserFromGroup(params.id, user_id, 'admin');
        return NextResponse.json({ success: true, message: 'User removed from zalo group' }, { status: 200 });
    } catch (error) {
        logger.error(`Error removing user from zalo group: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
