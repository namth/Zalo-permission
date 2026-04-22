/**
 * GET  /api/agent/check-membership?zalo_id=...&thread_id=...
 * POST /api/agent/check-membership  { zalo_id, thread_id }
 *
 * Kiểm tra xem một ZaloUser (zalo_id) có là thành viên của
 * một ZaloGroup (thread_id) hay không, dựa trên quan hệ
 * Neo4j: ZaloUser -[:MEMBER_OF]-> ZaloGroup
 */

import { NextRequest, NextResponse } from 'next/server';
import { neo4jClient } from '@/lib/neo4j';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Shared handler logic
// ---------------------------------------------------------------------------

async function handleCheckMembership(
    zalo_id: string | null,
    thread_id: string | null
): Promise<NextResponse> {
    if (!zalo_id || !thread_id) {
        return NextResponse.json(
            {
                success: false,
                error: 'Missing required parameters: zalo_id, thread_id',
            },
            { status: 400 }
        );
    }

    logger.info(
        `[API] check-membership - zalo_id: ${zalo_id}, thread_id: ${thread_id}`
    );

    const result = await neo4jClient.checkGroupMembership(zalo_id, thread_id);

    logger.info(
        `[API] check-membership result: is_member=${result.is_member}, role=${result.role}, user_id=${result.user_id}, workspace_uuid=${result.workspace_uuid}`
    );

    return NextResponse.json(
        {
            success: true,
            data: {
                zalo_id,
                thread_id,
                is_member: result.is_member,
                user_id: result.user_id,
                role: result.role,
                group_uuid: result.group_uuid,
                group_name: result.group_name,
                workspace_uuid: result.workspace_uuid,
                workspace_name: result.workspace_name,
            },
        },
        { status: 200 }
    );
}

// ---------------------------------------------------------------------------
// GET /api/agent/check-membership?zalo_id=...&thread_id=...
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = req.nextUrl;
        const zalo_id = searchParams.get('zalo_id');
        const thread_id = searchParams.get('thread_id');

        return await handleCheckMembership(zalo_id, thread_id);
    } catch (error) {
        logger.error(`[API] GET /api/agent/check-membership error: ${error}`);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}

// ---------------------------------------------------------------------------
// POST /api/agent/check-membership  { zalo_id, thread_id }
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const body = await req.json();
        const { zalo_id, thread_id } = body ?? {};

        return await handleCheckMembership(zalo_id ?? null, thread_id ?? null);
    } catch (error) {
        logger.error(`[API] POST /api/agent/check-membership error: ${error}`);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
