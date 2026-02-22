/**
 * Audit Log Service
 * Tracks all agent activities for compliance and debugging
 */

import { Pool } from 'pg';
import { AuditLog, AuditLogRequest } from '../types';
import { logger } from '../lib/logger';

export class AuditLogService {
  constructor(private db: Pool) { }

  /**
   * Create an audit log entry
   */
  async createAuditLog(request: AuditLogRequest): Promise<AuditLog> {
    try {
      const query = `
        INSERT INTO audit_logs (
          workspace_id, thread_id, user_id, action_type,
          input_data, output_data, status, error_message, metadata, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
        RETURNING *
      `;

      const result = await this.db.query(query, [
        request.workspace_id,
        request.thread_id || null,
        request.user_id || null,
        request.action_type,
        request.input_data ? JSON.stringify(request.input_data) : null,
        request.output_data ? JSON.stringify(request.output_data) : null,
        request.status,
        request.error_message || null,
        request.metadata ? JSON.stringify(request.metadata) : null,
      ]);

      const log = this.mapRowToAuditLog(result.rows[0]);
      logger.info(`Audit log created: ${log.id} (${request.action_type})`);

      return log;
    } catch (error) {
      logger.error(`Failed to create audit log: ${error}`);
      throw error;
    }
  }

  /**
   * Get audit log by ID
   */
  async getAuditLogById(id: string): Promise<AuditLog | null> {
    try {
      const query = 'SELECT * FROM audit_logs WHERE id = $1';
      const result = await this.db.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToAuditLog(result.rows[0]);
    } catch (error) {
      logger.error(`Failed to get audit log ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * List audit logs by workspace
   */
  async listAuditLogsByWorkspace(
    workspaceId: string,
    filters?: {
      actionType?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
    },
    limit: number = 100,
    offset: number = 0
  ): Promise<{ logs: AuditLog[]; total: number }> {
    try {
      let query = 'SELECT * FROM audit_logs WHERE workspace_id = $1';
      const params: any[] = [workspaceId];

      if (filters?.actionType) {
        query += ` AND action_type = $${params.length + 1}`;
        params.push(filters.actionType);
      }

      if (filters?.status) {
        query += ` AND status = $${params.length + 1}`;
        params.push(filters.status);
      }

      if (filters?.startDate) {
        query += ` AND created_at >= $${params.length + 1}`;
        params.push(filters.startDate);
      }

      if (filters?.endDate) {
        query += ` AND created_at <= $${params.length + 1}`;
        params.push(filters.endDate);
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await this.db.query(query, params);
      const logs = result.rows.map((row) => this.mapRowToAuditLog(row));

      // Get total count
      let countQuery = 'SELECT COUNT(*) as count FROM audit_logs WHERE workspace_id = $1';
      const countParams: any[] = [workspaceId];

      if (filters?.actionType) {
        countQuery += ` AND action_type = $${countParams.length + 1}`;
        countParams.push(filters.actionType);
      }

      if (filters?.status) {
        countQuery += ` AND status = $${countParams.length + 1}`;
        countParams.push(filters.status);
      }

      if (filters?.startDate) {
        countQuery += ` AND created_at >= $${countParams.length + 1}`;
        countParams.push(filters.startDate);
      }

      if (filters?.endDate) {
        countQuery += ` AND created_at <= $${countParams.length + 1}`;
        countParams.push(filters.endDate);
      }

      const countResult = await this.db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count, 10);

      return { logs, total };
    } catch (error) {
      logger.error(`Failed to list audit logs for workspace ${workspaceId}: ${error}`);
      throw error;
    }
  }

  /**
   * List audit logs by thread
   */
  async listAuditLogsByThread(
    threadId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ logs: AuditLog[]; total: number }> {
    try {
      const query = `
        SELECT * FROM audit_logs 
        WHERE thread_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await this.db.query(query, [threadId, limit, offset]);
      const logs = result.rows.map((row) => this.mapRowToAuditLog(row));

      // Get total count
      const countResult = await this.db.query('SELECT COUNT(*) as count FROM audit_logs WHERE thread_id = $1', [
        threadId,
      ]);
      const total = parseInt(countResult.rows[0].count, 10);

      return { logs, total };
    } catch (error) {
      logger.error(`Failed to list audit logs for thread ${threadId}: ${error}`);
      throw error;
    }
  }

  /**
   * List audit logs by user
   */
  async listAuditLogsByUser(
    userId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ logs: AuditLog[]; total: number }> {
    try {
      const query = `
        SELECT * FROM audit_logs 
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await this.db.query(query, [userId, limit, offset]);
      const logs = result.rows.map((row) => this.mapRowToAuditLog(row));

      // Get total count
      const countResult = await this.db.query('SELECT COUNT(*) as count FROM audit_logs WHERE user_id = $1', [userId]);
      const total = parseInt(countResult.rows[0].count, 10);

      return { logs, total };
    } catch (error) {
      logger.error(`Failed to list audit logs for user ${userId}: ${error}`);
      throw error;
    }
  }


  /**
   * Helper: Map database row to AuditLog interface
   */
  private mapRowToAuditLog(row: any): AuditLog {
    return {
      id: row.id,
      workspace_id: row.workspace_id,
      thread_id: row.thread_id,
      user_id: row.user_id,
      action_type: row.action_type,
      input_data: row.input_data ? JSON.parse(row.input_data) : undefined,
      output_data: row.output_data ? JSON.parse(row.output_data) : undefined,
      status: row.status,
      error_message: row.error_message,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      created_at: row.created_at.toISOString(),
    };
  }
}
