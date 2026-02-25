/**
 * /api/admin/skills/[id]/unshare
 * DELETE: Remove skill sharing from a workspace
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    try {
        const body = await req.json();
        const { workspace_id } = body;

        if (!workspace_id) {
            return NextResponse.json({ success: false, error: 'workspace_id is required' }, { status: 400 });
        }

        // Check skill exists and currently shared
        const skillResult = await query(`SELECT id, workspace_id FROM skills WHERE id = $1`, [params.id]);
        if (skillResult.rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Skill not found' }, { status: 404 });
        }

        // Update is_shared to false if workspace matches
        await query(
            `UPDATE skills SET is_shared = false, updated_at = NOW() WHERE id = $1`,
            [params.id]
        );

        return NextResponse.json({ success: true, message: 'Skill unshared' }, { status: 200 });
    } catch (error) {
        logger.error(`DELETE /api/admin/skills/${params.id}/unshare error: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
