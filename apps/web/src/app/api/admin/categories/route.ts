import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { neo4jClient } from '@/lib/neo4j';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
    try {
        const result = await neo4jClient.run(`MATCH (c:Category) RETURN c.name as name ORDER BY name`);
        const categories = result.records.map(record => record.get('name'));

        return NextResponse.json({
            success: true,
            data: categories
        }, { status: 200 });
    } catch (error) {
        logger.error(`GET /api/admin/categories error: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
