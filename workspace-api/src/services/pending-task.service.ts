/**
 * Pending Task Service
 * Manages tasks waiting for missing input data from users
 */

import { Pool } from 'pg';
import { PendingTask, PendingTaskRequest, PlanStep } from '../types';
import { logger } from '../lib/logger';

export class PendingTaskService {
  constructor(private db: Pool) {}

  /**
   * Create or update a pending task
   */
  async upsertPendingTask(request: PendingTaskRequest): Promise<PendingTask> {
    try {
      // Check if task already exists
      const existingQuery = `
        SELECT * FROM pending_tasks 
        WHERE thread_id = $1 AND user_id = $2 AND workspace_id = $3
      `;

      const existingResult = await this.db.query(existingQuery, [
        request.thread_id,
        request.user_id,
        request.workspace_id,
      ]);

      let task: PendingTask;

      if (existingResult.rows.length > 0) {
        // Update existing task
        task = await this.updatePendingTask(existingResult.rows[0].id, request);
      } else {
        // Create new task
        task = await this.createPendingTask(request);
      }

      return task;
    } catch (error) {
      logger.error(`Failed to upsert pending task: ${error}`);
      throw error;
    }
  }

  /**
   * Create a new pending task
   */
  private async createPendingTask(request: PendingTaskRequest): Promise<PendingTask> {
    try {
      const query = `
        INSERT INTO pending_tasks (
          workspace_id, thread_id, user_id, intent, full_plan, 
          missing_parameters, status, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `;

      const result = await this.db.query(query, [
        request.workspace_id,
        request.thread_id,
        request.user_id,
        request.intent || null,
        request.full_plan ? JSON.stringify(request.full_plan) : null,
        request.missing_parameters ? JSON.stringify(request.missing_parameters) : null,
        request.status,
      ]);

      logger.info(`Pending task created: ${result.rows[0].id}`);
      return this.mapRowToPendingTask(result.rows[0]);
    } catch (error) {
      logger.error(`Failed to create pending task: ${error}`);
      throw error;
    }
  }

  /**
   * Update an existing pending task
   */
  private async updatePendingTask(taskId: string, request: PendingTaskRequest): Promise<PendingTask> {
    try {
      const query = `
        UPDATE pending_tasks
        SET 
          intent = COALESCE($2, intent),
          full_plan = COALESCE($3, full_plan),
          missing_parameters = COALESCE($4, missing_parameters),
          status = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;

      const result = await this.db.query(query, [
        taskId,
        request.intent || null,
        request.full_plan ? JSON.stringify(request.full_plan) : null,
        request.missing_parameters ? JSON.stringify(request.missing_parameters) : null,
        request.status,
      ]);

      logger.info(`Pending task ${taskId} updated`);
      return this.mapRowToPendingTask(result.rows[0]);
    } catch (error) {
      logger.error(`Failed to update pending task ${taskId}: ${error}`);
      throw error;
    }
  }

  /**
   * Get pending task by ID
   */
  async getPendingTaskById(id: string): Promise<PendingTask | null> {
    try {
      const query = 'SELECT * FROM pending_tasks WHERE id = $1';
      const result = await this.db.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToPendingTask(result.rows[0]);
    } catch (error) {
      logger.error(`Failed to get pending task ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * Get pending tasks by thread and user
   */
  async getPendingTaskByThreadAndUser(threadId: string, userId: string, workspaceId: string): Promise<PendingTask | null> {
    try {
      const query = `
        SELECT * FROM pending_tasks 
        WHERE thread_id = $1 AND user_id = $2 AND workspace_id = $3
        AND status IN ('AWAITING_INPUT', 'READY_TO_RESUME')
        ORDER BY updated_at DESC
        LIMIT 1
      `;

      const result = await this.db.query(query, [threadId, userId, workspaceId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToPendingTask(result.rows[0]);
    } catch (error) {
      logger.error(`Failed to get pending task for thread ${threadId}: ${error}`);
      throw error;
    }
  }

  /**
   * List pending tasks by status
   */
  async listPendingTasksByStatus(
    status: 'AWAITING_INPUT' | 'READY_TO_RESUME' | 'COMPLETED',
    workspaceId?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ tasks: PendingTask[]; total: number }> {
    try {
      let query = 'SELECT * FROM pending_tasks WHERE status = $1';
      const params: any[] = [status];

      if (workspaceId) {
        query += ` AND workspace_id = $${params.length + 1}`;
        params.push(workspaceId);
      }

      query += ` ORDER BY updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await this.db.query(query, params);
      const tasks = result.rows.map((row) => this.mapRowToPendingTask(row));

      // Get total count
      let countQuery = 'SELECT COUNT(*) as count FROM pending_tasks WHERE status = $1';
      const countParams: any[] = [status];

      if (workspaceId) {
        countQuery += ` AND workspace_id = $${countParams.length + 1}`;
        countParams.push(workspaceId);
      }

      const countResult = await this.db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count, 10);

      return { tasks, total };
    } catch (error) {
      logger.error(`Failed to list pending tasks: ${error}`);
      throw error;
    }
  }

  /**
   * Mark task as completed
   */
  async completePendingTask(taskId: string): Promise<PendingTask> {
    try {
      const query = `
        UPDATE pending_tasks
        SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;

      const result = await this.db.query(query, [taskId]);

      if (result.rows.length === 0) {
        throw new Error(`Pending task ${taskId} not found`);
      }

      logger.info(`Pending task ${taskId} marked as completed`);
      return this.mapRowToPendingTask(result.rows[0]);
    } catch (error) {
      logger.error(`Failed to complete pending task ${taskId}: ${error}`);
      throw error;
    }
  }

  /**
   * Mark task as ready to resume
   */
  async markReadyToResume(taskId: string, fullPlan?: PlanStep[]): Promise<PendingTask> {
    try {
      let query = `
        UPDATE pending_tasks
        SET status = 'READY_TO_RESUME', updated_at = CURRENT_TIMESTAMP
      `;

      const params: any[] = [];

      if (fullPlan) {
        query += `, full_plan = $1`;
        params.push(JSON.stringify(fullPlan));
      }

      query += ` WHERE id = $${params.length + 1} RETURNING *`;
      params.push(taskId);

      const result = await this.db.query(query, params);

      if (result.rows.length === 0) {
        throw new Error(`Pending task ${taskId} not found`);
      }

      logger.info(`Pending task ${taskId} marked as ready to resume`);
      return this.mapRowToPendingTask(result.rows[0]);
    } catch (error) {
      logger.error(`Failed to mark pending task ${taskId} as ready: ${error}`);
      throw error;
    }
  }

  /**
   * Delete pending task
   */
  async deletePendingTask(taskId: string): Promise<void> {
    try {
      const query = 'DELETE FROM pending_tasks WHERE id = $1';
      await this.db.query(query, [taskId]);
      logger.info(`Pending task ${taskId} deleted`);
    } catch (error) {
      logger.error(`Failed to delete pending task ${taskId}: ${error}`);
      throw error;
    }
  }

  /**
   * Helper: Map database row to PendingTask interface
   */
  private mapRowToPendingTask(row: any): PendingTask {
    return {
      id: row.id,
      workspace_id: row.workspace_id,
      thread_id: row.thread_id,
      user_id: row.user_id,
      intent: row.intent,
      full_plan: row.full_plan ? JSON.parse(row.full_plan) : undefined,
      missing_parameters: row.missing_parameters ? JSON.parse(row.missing_parameters) : undefined,
      status: row.status,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  }
}
