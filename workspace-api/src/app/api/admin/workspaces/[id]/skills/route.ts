
import { NextRequest, NextResponse } from 'next/server';
import {
    getWorkspaceSkills,
    deleteSkill
} from '@/services/workspace.service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        const limit = parseInt(req.nextUrl.searchParams.get('limit') || '100', 10);
        const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0', 10);

        const { skills, total } = await getWorkspaceSkills(params.id, limit, offset);

        return NextResponse.json({
            success: true,
            data: skills,
            pagination: { limit, offset, total }
        }, { status: 200 });
    } catch (error) {
        logger.error(`Error fetching workspace skills: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        const url = new URL(req.url);
        const skill_id = url.searchParams.get('skill_id');

        if (!skill_id) {
            return NextResponse.json({ success: false, error: 'skill_id is required' }, { status: 400 });
        }

        await deleteSkill(skill_id, 'admin');
        return NextResponse.json({ success: true, message: 'Skill deleted' }, { status: 200 });
    } catch (error) {
        logger.error(`Error deleting skill: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
