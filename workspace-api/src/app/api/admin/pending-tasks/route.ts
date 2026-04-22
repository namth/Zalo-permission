import { NextRequest, NextResponse } from 'next/server';
import { AuditLogService } from '@/services';
import { getDb } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const status = req.nextUrl.searchParams.get('status');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '100', 10);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0', 10);

    logger.info(`[API] GET /api/admin/pending-tasks - status: ${status || 'all'}, limit: ${limit}, offset: ${offset}`);

    const db = getDb();
    let query = `SELECT * FROM pending_tasks`;
    const params: any[] = [];

    if (status) {
      query += ` WHERE status = $1`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    const countResult = await db.query(
      status ? `SELECT COUNT(*) as total FROM pending_tasks WHERE status = $1` : `SELECT COUNT(*) as total FROM pending_tasks`,
      status ? [status] : []
    );
    const total = parseInt(countResult.rows[0].total, 10);

    return NextResponse.json(
      {
        success: true,
        data: result.rows,
        pagination: {
          limit,
          offset,
          total,
          hasMore: offset + limit < total,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error(`[API] GET /api/admin/pending-tasks error: ${error}`);

    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { workspace_id, thread_id, user_id, intent, full_plan, missing_parameters, status } = body;

    logger.info(`[API] POST /api/admin/pending-tasks - thread_id: ${thread_id}`);

    if (!workspace_id || !thread_id || !user_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: workspace_id, thread_id, user_id',
        },
        { status: 400 }
      );
    }

    const db = getDb();
    
    // Create pending task
    const query = `
      INSERT INTO pending_tasks (workspace_id, thread_id, user_id, intent, full_plan, missing_parameters, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const params = [
      workspace_id,
      thread_id,
      user_id,
      intent || null,
      full_plan ? JSON.stringify(full_plan) : null,
      missing_parameters ? JSON.stringify(missing_parameters) : null,
      status || 'AWAITING_INPUT'
    ];

    const result = await db.query(query, params);
    const pendingTask = result.rows[0];

    // Log audit
    const auditLogService = new AuditLogService(db);
    await auditLogService.createAuditLog({
      workspace_id: workspace_id,
      action_type: 'PENDING_TASK_CREATED',
      input_data: { thread_id, intent },
      output_data: { task_id: pendingTask.id },
      status: 'success',
    });

    return NextResponse.json(
      {
        success: true,
        data: pendingTask,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error(`[API] POST /api/admin/pending-tasks error: ${error}`);

    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
