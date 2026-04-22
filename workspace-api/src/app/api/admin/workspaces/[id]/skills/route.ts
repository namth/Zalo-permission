
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

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        const workspaceId = params.id;
        const body = await req.json();
        const { skill_id } = body;

        if (!skill_id) {
            return NextResponse.json({ success: false, error: 'skill_id is required' }, { status: 400 });
        }

        const { neo4jClient } = await import('@/lib/neo4j');
        await neo4jClient.createSharingRelationship(skill_id, workspaceId);

        return NextResponse.json({ success: true, message: 'Skill linked to workspace' }, { status: 200 });
    } catch (error) {
        logger.error(`Error linking skill to workspace: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        const workspaceId = params.id;
        const url = new URL(req.url);
        const skill_id = url.searchParams.get('skill_id');

        if (!skill_id) {
            return NextResponse.json({ success: false, error: 'skill_id is required' }, { status: 400 });
        }

        const { neo4jClient } = await import('@/lib/neo4j');
        await neo4jClient.removeSharingRelationship(skill_id, workspaceId);

        return NextResponse.json({ success: true, message: 'Skill unlinked from workspace' }, { status: 200 });
    } catch (error) {
        logger.error(`Error unlinking skill: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
