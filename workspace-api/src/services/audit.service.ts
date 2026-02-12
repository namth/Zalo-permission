import { query } from "@/lib/db";

/**
 * Helper to safely convert data to JSON-serializable format
 */
function makeJsonSerializable(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }
  
  if (data instanceof Date) {
    return data.toISOString();
  }
  
  if (Array.isArray(data)) {
    return data.map(makeJsonSerializable);
  }
  
  if (typeof data === 'object') {
    const result: any = {};
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        result[key] = makeJsonSerializable(data[key]);
      }
    }
    return result;
  }
  
  return data;
}

/**
 * Audit Log Type (aligned with new schema)
 */
export interface AuditLog {
  id: string;
  workspace_id: string | null;
  thread_id: string | null;
  user_id: string | null;
  agent_role: string | null;  // 'Planner' | 'Worker' | 'Observer'
  action_type: string;
  input_data: any;
  output_data: any;
  status: string;
  error_message: string | null;
  metadata: any;
  created_at: Date;
}

/**
 * Log an audit action
 */
export async function logAuditAction(
  workspace_id: string | null,
  thread_id: string | null = null,
  user_id: string | null = null,
  agent_role: string | null = null,
  action_type: string,
  input_data: any = null,
  output_data: any = null,
  status: string = "success",
  error_message: string | null = null,
  metadata: any = null,
): Promise<AuditLog> {
  // Ensure all data is JSON-serializable (convert Date objects to ISO strings)
  const serializedInputData = input_data ? makeJsonSerializable(input_data) : null;
  const serializedOutputData = output_data ? makeJsonSerializable(output_data) : null;
  const serializedMetadata = metadata ? makeJsonSerializable(metadata) : null;

  const result = await query(
    `INSERT INTO audit_logs 
       (workspace_id, thread_id, user_id, agent_role, action_type, input_data, output_data, status, error_message, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING id, workspace_id, thread_id, user_id, agent_role, action_type, input_data, output_data, status, error_message, metadata, created_at`,
    [
      workspace_id,
      thread_id,
      user_id,
      agent_role,
      action_type,
      serializedInputData ? JSON.stringify(serializedInputData) : null,
      serializedOutputData ? JSON.stringify(serializedOutputData) : null,
      status,
      error_message,
      serializedMetadata ? JSON.stringify(serializedMetadata) : null,
    ],
  );

  if (result.rows.length === 0) {
    throw new Error("Failed to create audit log");
  }

  const log = result.rows[0];
  // Parse JSON fields
  if (log.input_data) {
    log.input_data = JSON.parse(log.input_data);
  }
  if (log.output_data) {
    log.output_data = JSON.parse(log.output_data);
  }
  if (log.metadata) {
    log.metadata = JSON.parse(log.metadata);
  }

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
    `SELECT id, workspace_id, thread_id, user_id, agent_role, action_type, input_data, output_data, status, error_message, metadata, created_at
     FROM audit_logs
     WHERE workspace_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [workspace_id, limit, offset],
  );

  return {
    logs: result.rows.map(parseAuditLog),
    total,
  };
}

/**
 * Get audit logs for a specific action type
 */
export async function getAuditLogsByActionType(
  action_type: string,
  workspace_id?: string,
  limit: number = 50,
): Promise<AuditLog[]> {
  let queryStr = `SELECT * FROM audit_logs WHERE action_type = $1`;
  const params: any[] = [action_type];

  if (workspace_id) {
    params.push(workspace_id);
    queryStr += ` AND workspace_id = $${params.length}`;
  }

  queryStr += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await query(queryStr, params);

  return result.rows.map(parseAuditLog);
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
    `SELECT id, workspace_id, thread_id, user_id, agent_role, action_type, input_data, output_data, status, error_message, metadata, created_at
     FROM audit_logs
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [user_id, limit, offset],
  );

  return {
    logs: result.rows.map(parseAuditLog),
    total,
  };
}

/**
 * Get all audit logs with optional filtering
 */
export async function getAllAuditLogs(
  limit: number = 50,
  offset: number = 0,
  action_type?: string,
  workspace_id?: string,
): Promise<{ logs: AuditLog[]; total: number }> {
  let whereClause = "";
  let params: any[] = [];
  let paramIndex = 1;

  if (action_type) {
    whereClause = `WHERE action_type ILIKE $${paramIndex}`;
    params.push(`%${action_type}%`);
    paramIndex++;
  }

  if (workspace_id) {
    if (whereClause) {
      whereClause += ` AND workspace_id = $${paramIndex}`;
    } else {
      whereClause = `WHERE workspace_id = $${paramIndex}`;
    }
    params.push(workspace_id);
    paramIndex++;
  }

  const countResult = await query(
    `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`,
    params,
  );

  const total = countResult.rows[0].count;

  const result = await query(
    `SELECT id, workspace_id, thread_id, user_id, agent_role, action_type, input_data, output_data, status, error_message, metadata, created_at
     FROM audit_logs
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset],
  );

  return {
    logs: result.rows.map(parseAuditLog),
    total,
  };
}

/**
 * Log audit error
 */
export async function logAuditError(
  workspace_id: string | null,
  thread_id: string | null,
  user_id: string | null,
  action_type: string,
  error: Error | string,
  metadata: any = null,
): Promise<AuditLog> {
  const errorMessage = error instanceof Error ? error.message : String(error);

  return logAuditAction(
    workspace_id,
    thread_id,
    user_id,
    null,  // agent_role
    action_type,
    null,
    null,
    "failed",
    errorMessage,
    metadata,
  );
}

/**
 * Helper: Parse JSON fields in audit log
 */
function parseAuditLog(row: any): AuditLog {
  return {
    ...row,
    input_data: row.input_data ? JSON.parse(row.input_data) : undefined,
    output_data: row.output_data ? JSON.parse(row.output_data) : undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  };
}
