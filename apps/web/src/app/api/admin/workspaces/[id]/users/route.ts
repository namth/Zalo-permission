
import { NextRequest, NextResponse } from 'next/server';
import {
    getWorkspaceUsers,
    assignUserRole,
    removeUserFromWorkspace
} from '@/services/workspace.service';
import { UserService } from '@/services/user.service';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        const user = await getCurrentUser(req);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // Check membership if not admin
        if (user.role !== 'admin') {
            const userRoleInWorkspace = await UserService.getUserRoleInWorkspace(params.id, user.id);
            if (!userRoleInWorkspace) {
                return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
            }
        }

        const limit = parseInt(req.nextUrl.searchParams.get('limit') || '100', 10);
        const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0', 10);

        const { users, total } = await getWorkspaceUsers(params.id, limit, offset);

        return NextResponse.json({
            success: true,
            data: users,
            pagination: { limit, offset, total }
        }, { status: 200 });
    } catch (error) {
        logger.error(`Error fetching workspace users: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        const user = await getCurrentUser(req);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        if (user.role !== 'admin') {
            return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
        }

        const body = await req.json();
        const { user_id, role } = body;

        if (!user_id || !role) {
            return NextResponse.json({ success: false, error: 'user_id and role are required' }, { status: 400 });
        }

        const result = await assignUserRole(params.id, user_id, role, user.id);
        return NextResponse.json({ success: true, data: result }, { status: 201 });
    } catch (error) {
        logger.error(`Error assigning user role: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        const user = await getCurrentUser(req);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        if (user.role !== 'admin') {
            return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
        }

        const url = new URL(req.url);
        const user_id = url.searchParams.get('user_id');

        if (!user_id) {
            return NextResponse.json({ success: false, error: 'user_id is required' }, { status: 400 });
        }

        await removeUserFromWorkspace(params.id, user_id, user.id);
        return NextResponse.json({ success: true, message: 'User removed from workspace' }, { status: 200 });
    } catch (error) {
        logger.error(`Error removing user from workspace: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
