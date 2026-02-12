/**
 * POST /api/agent/pending-task
 * 
 * Create or update pending tasks
 * Used by n8n Planner to save tasks awaiting user input
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { PendingTaskRequest, PendingTaskResponse } from '@/types';
import { PendingTaskService, AuditLogService } from '@/services';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function POST(req: NextRequest): Promise<NextResponse<PendingTaskResponse>> {
  try {
    const body: PendingTaskRequest = await req.json();
    const { workspace_id, thread_id, user_id, status } = body;

    logger.info(`[API] POST /api/agent/pending-task - user: ${user_id}, thread: ${thread_id}, status: ${status}`);

    // Validation
    if (!workspace_id || !thread_id || !user_id || !status) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: workspace_id, thread_id, user_id, status',
        },
        { status: 400 }
      );
    }

    const validStatuses = ['AWAITING_INPUT', 'READY_TO_RESUME', 'COMPLETED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Initialize services
    const pendingTaskService = new PendingTaskService(db);
    const auditLogService = new AuditLogService(db);

    // Upsert pending task
    const task = await pendingTaskService.upsertPendingTask(body);

    // Log audit
    await auditLogService.createAuditLog({
      workspace_id,
      thread_id,
      user_id,
      agent_role: 'Planner',
      action_type: 'PENDING_TASK_UPDATE',
      input_data: body,
      output_data: { task_id: task.id, status: task.status },
      status: 'success',
    });

    const response: PendingTaskResponse = {
      success: true,
      data: task,
    };

    logger.info(`[API] Pending task ${task.id} saved with status ${task.status}`);

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    logger.error(`[API] POST /api/agent/pending-task error: ${error}`);

    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest): Promise<NextResponse<PendingTaskResponse>> {
  try {
    const threadId = req.nextUrl.searchParams.get('thread_id');
    const userId = req.nextUrl.searchParams.get('user_id');
    const workspaceId = req.nextUrl.searchParams.get('workspace_id');

    logger.info(
      `[API] GET /api/agent/pending-task - thread: ${threadId}, user: ${userId}, workspace: ${workspaceId}`
    );

    if (!threadId || !userId || !workspaceId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required query parameters: thread_id, user_id, workspace_id',
        },
        { status: 400 }
      );
    }

    const pendingTaskService = new PendingTaskService(db);
    const task = await pendingTaskService.getPendingTaskByThreadAndUser(threadId, userId, workspaceId);

    if (!task) {
      return NextResponse.json(
        {
          success: false,
          error: 'No pending task found',
        },
        { status: 404 }
      );
    }

    const response: PendingTaskResponse = {
      success: true,
      data: task,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    logger.error(`[API] GET /api/agent/pending-task error: ${error}`);

    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
