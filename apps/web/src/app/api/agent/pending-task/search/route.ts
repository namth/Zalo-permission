import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user_id = req.nextUrl.searchParams.get('user_id');
    const thread_id = req.nextUrl.searchParams.get('thread_id');
    const status = req.nextUrl.searchParams.get('status');

    if (!user_id || !thread_id || !status) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: user_id, thread_id, status' },
        { status: 400 }
      );
    }

    logger.info(`[API] GET /api/agent/pending-task/search - user: ${user_id}, thread: ${thread_id}, status: ${status}`);

    const db = getDb();
    const query = `
      SELECT * FROM pending_tasks 
      WHERE user_id = $1 AND thread_id = $2 AND status = $3 
      ORDER BY updated_at DESC 
      LIMIT 1
    `;
    const result = await db.query(query, [user_id, thread_id, status]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: true, data: null },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { success: true, data: result.rows[0] },
      { status: 200 }
    );
  } catch (error) {
    logger.error(`[API] GET /api/agent/pending-task/search error: ${error}`);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { user_id, thread_id, status } = body;

    if (!user_id || !thread_id || !status) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: user_id, thread_id, status' },
        { status: 400 }
      );
    }

    logger.info(`[API] POST /api/agent/pending-task/search - user: ${user_id}, thread: ${thread_id}, status: ${status}`);

    const db = getDb();
    const query = `
      SELECT * FROM pending_tasks 
      WHERE user_id = $1 AND thread_id = $2 AND status = $3 
      ORDER BY updated_at DESC 
      LIMIT 1
    `;
    const result = await db.query(query, [user_id, thread_id, status]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: true, data: null },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { success: true, data: result.rows[0] },
      { status: 200 }
    );
  } catch (error) {
    logger.error(`[API] POST /api/agent/pending-task/search error: ${error}`);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
