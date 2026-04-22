
import { NextRequest, NextResponse } from 'next/server';
import { ZaloGroupService } from '@/services/zalo-group.service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// GET /api/admin/zalo-groups/[id]
export async function GET(
    _req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        const group = await ZaloGroupService.getGroupById(params.id);
        if (!group) {
            return NextResponse.json({ success: false, error: 'Zalo Group not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: group }, { status: 200 });
    } catch (error) {
        logger.error(`Error fetching zalo group: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

// PATCH /api/admin/zalo-groups/[id]
// Body: { name: string }
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        const body = await req.json();
        const { name } = body;

        if (!name || typeof name !== 'string' || !name.trim()) {
            return NextResponse.json({ success: false, error: 'name is required and cannot be empty' }, { status: 400 });
        }

        const updated = await ZaloGroupService.updateGroupName(params.id, name);
        return NextResponse.json({ success: true, data: updated }, { status: 200 });
    } catch (error) {
        logger.error(`Error updating zalo group name: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
