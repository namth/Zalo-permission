
import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/services/user.service';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
    try {
        const search = req.nextUrl.searchParams.get('search') || undefined;
        const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20', 10);
        const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0', 10);

        const { users, total } = await UserService.getUsers(limit, offset, search);

        return NextResponse.json(
            {
                success: true,
                data: users,
                pagination: {
                    limit,
                    offset,
                    total,
                },
            },
            { status: 200 }
        );
    } catch (error) {
        logger.error(`[API] GET /api/admin/users error: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const currentUser = await getCurrentUser(req);
        const body = await req.json();
        const user = await UserService.createUser(body, currentUser?.id);

        return NextResponse.json({ success: true, data: user }, { status: 201 });
    } catch (error) {
        logger.error(`[API] POST /api/admin/users error: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
