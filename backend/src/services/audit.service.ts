import { query } from "@/lib/db";

/**
 * Audit Log Type
 */
export interface AuditLog {
  id: string;
  workspace_id: string | null;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_value: any;
  new_value: any;
  ip_address: string | null;
  status: string;
  error_message: string | null;
  created_at: Date;
}

/**
 * Log an audit action
 */
export async function logAuditAction(
  workspace_id: string | null,
  user_id: string | null,
  action: string,
  entity_type: string,
  entity_id: string | null,
  old_value: any = null,
  new_value: any = null,
  ip_address: string | null = null,
  status: string = "SUCCESS",
  error_message: string | null = null,
): Promise<AuditLog> {
  const result = await query(
    `INSERT INTO audit_logs 
      (workspace_id, user_id, action, entity_type, entity_id, old_value, new_value, ip_address, status, error_message, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
     RETURNING id, workspace_id, user_id, action, entity_type, entity_id, old_value, new_value, ip_address, status, error_message, created_at`,
    [
      workspace_id,
      user_id,
      action,
      entity_type,
      entity_id,
      JSON.stringify(old_value),
      JSON.stringify(new_value),
      ip_address,
      status,
      error_message,
    ],
  );

  if (result.rows.length === 0) {
    throw new Error("Failed to create audit log");
  }

  const log = result.rows[0];
  log.old_value = old_value;
  log.new_value = new_value;

  return log;
}

/**
 * Get audit logs for a workspace
 */
export async function getAuditLogs(
  workspace_id: string,
  limit: number = 50,
  offset: number = 0,
): Promise<{ logs: AuditLog[]; total: number }> {
  const countResult = await query(
    `SELECT COUNT(*) as count FROM audit_logs WHERE workspace_id = $1`,
    [workspace_id],
  );

  const total = countResult.rows[0].count;

  const result = await query(
    `SELECT id, workspace_id, user_id, action, entity_type, entity_id, status, error_message, created_at
     FROM audit_logs
     WHERE workspace_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [workspace_id, limit, offset],
  );

  return {
    logs: result.rows,
    total,
  };
}

/**
 * Get audit logs for a specific entity
 */
export async function getAuditLogsForEntity(
  entity_type: string,
  entity_id: string,
  limit: number = 50,
): Promise<AuditLog[]> {
  const result = await query(
    `SELECT id, workspace_id, user_id, action, entity_type, entity_id, status, error_message, created_at
     FROM audit_logs
     WHERE entity_type = $1 AND entity_id = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [entity_type, entity_id, limit],
  );

  return result.rows;
}

/**
 * Get audit logs for a user
 */
export async function getAuditLogsForUser(
  user_id: string,
  limit: number = 50,
  offset: number = 0,
): Promise<{ logs: AuditLog[]; total: number }> {
  const countResult = await query(
    `SELECT COUNT(*) as count FROM audit_logs WHERE user_id = $1`,
    [user_id],
  );

  const total = countResult.rows[0].count;

  const result = await query(
    `SELECT id, workspace_id, user_id, action, entity_type, entity_id, status, error_message, created_at
     FROM audit_logs
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [user_id, limit, offset],
  );

  return {
    logs: result.rows,
    total,
  };
}

/**
 * Get all audit logs with optional filtering
 */
export async function getAllAuditLogs(
  limit: number = 50,
  offset: number = 0,
  action?: string,
): Promise<{ logs: AuditLog[]; total: number }> {
  let whereClause = "";
  let params: any[] = [];
  let paramIndex = 1;

  if (action) {
    whereClause = `WHERE action ILIKE $${paramIndex}`;
    params.push(`%${action}%`);
    paramIndex++;
  }

  const countResult = await query(
    `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`,
    params,
  );

  const total = countResult.rows[0].count;

  const result = await query(
    `SELECT id, workspace_id, user_id, action, entity_type, entity_id, status, error_message, created_at
     FROM audit_logs
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset],
  );

  return {
    logs: result.rows,
    total,
  };
}

/**
 * Log audit error
 */
export async function logAuditError(
  workspace_id: string | null,
  user_id: string | null,
  action: string,
  entity_type: string,
  entity_id: string | null,
  error: Error | string,
  ip_address: string | null = null,
): Promise<AuditLog> {
  const errorMessage = error instanceof Error ? error.message : String(error);

  return logAuditAction(
    workspace_id,
    user_id,
    action,
    entity_type,
    entity_id,
    null,
    null,
    ip_address,
    "FAILED",
    errorMessage,
  );
}
