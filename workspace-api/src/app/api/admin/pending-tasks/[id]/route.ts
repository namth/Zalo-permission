import { NextRequest, NextResponse } from 'next/server';
import { AuditLogService } from '@/services';
import { getDb } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const { id } = params;
    logger.info(`[API] GET /api/admin/pending-tasks/${id}`);

    const db = getDb();
    const result = await db.query('SELECT * FROM pending_tasks WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Pending task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, data: result.rows[0] },
      { status: 200 }
    );
  } catch (error) {
    logger.error(`[API] GET /api/admin/pending-tasks/[id] error: ${error}`);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const { id } = params;
    const body = await req.json();
    
    logger.info(`[API] PUT /api/admin/pending-tasks/${id}`);

    const db = getDb();
    
    // Check if exists
    const existing = await db.query('SELECT * FROM pending_tasks WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Pending task not found' },
        { status: 404 }
      );
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const allowedFields = ['workspace_id', 'thread_id', 'user_id', 'intent', 'status', 'full_plan', 'missing_parameters'];
    
    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = $${paramIndex}`);
        if (key === 'full_plan' || key === 'missing_parameters') {
          values.push(value ? JSON.stringify(value) : null);
        } else {
          values.push(value);
        }
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    values.push(id);
    const query = `
      UPDATE pending_tasks 
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $${paramIndex} 
      RETURNING *
    `;

    const result = await db.query(query, values);
    const pendingTask = result.rows[0];

    // Log audit
    const auditLogService = new AuditLogService(db);
    await auditLogService.createAuditLog({
      workspace_id: pendingTask.workspace_id,
      action_type: 'PENDING_TASK_UPDATED',
      input_data: { fields_updated: Object.keys(body) },
      output_data: { task_id: pendingTask.id },
      status: 'success',
    });

    return NextResponse.json(
      { success: true, data: pendingTask },
      { status: 200 }
    );
  } catch (error) {
    logger.error(`[API] PUT /api/admin/pending-tasks/[id] error: ${error}`);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const { id } = params;
    logger.info(`[API] DELETE /api/admin/pending-tasks/${id}`);

    const db = getDb();
    
    // Get before deleting for audit log
    const existing = await db.query('SELECT * FROM pending_tasks WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Pending task not found' },
        { status: 404 }
      );
    }

    const task = existing.rows[0];

    await db.query('DELETE FROM pending_tasks WHERE id = $1', [id]);

    // Log audit
    const auditLogService = new AuditLogService(db);
    await auditLogService.createAuditLog({
      workspace_id: task.workspace_id,
      action_type: 'PENDING_TASK_DELETED',
      input_data: { task_id: id },
      output_data: {},
      status: 'success',
    });

    return NextResponse.json(
      { success: true, message: 'Pending task deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    logger.error(`[API] DELETE /api/admin/pending-tasks/[id] error: ${error}`);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
