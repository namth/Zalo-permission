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

        // Check skill exists
        const skillResult = await query(`SELECT id FROM skills WHERE id = $1`, [params.id]);
        if (skillResult.rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Skill not found' }, { status: 404 });
        }

        // Remove from Neo4j
        const { neo4jClient } = await import('@/lib/neo4j');
        await neo4jClient.removeSharingRelationship(params.id, workspace_id);

        // Update is_shared in Postgres
        // We set it to false only if there are no more sharing relationships in Neo4j?
        // Or just let it be. For now, we follow the legacy logic but we should ideally check Neo4j.
        const remainingShares = await neo4jClient.run(
            'MATCH (s:Skill {id: $skillId})-[r:SHARED_TO]->(w:Workspace) RETURN count(r) as count',
            { skillId: params.id }
        );
        const count = remainingShares.records[0].get('count').toNumber();
        
        if (count === 0) {
            await query(
                `UPDATE skills SET is_shared = false, updated_at = NOW() WHERE id = $1`,
                [params.id]
            );
        }

        return NextResponse.json({ success: true, message: 'Skill unshared' }, { status: 200 });
    } catch (error) {
        logger.error(`DELETE /api/admin/skills/${params.id}/unshare error: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
