/**
 * Worker Service
 * Executes tasks according to the plan created by Planner
 * 
 * Responsibilities:
 * 1. Execute tool calls in sequence
 * 2. Verify tool permissions via Neo4j
 * 3. Handle errors gracefully
 * 4. Return results for Observer validation
 */

import { Pool } from 'pg';
import { PlanStep, Tool } from '../types';
import { ToolService } from './tool.service';
import { AuditLogService } from './audit-log.service';
import { neo4jClient } from '../lib/neo4j';
import { logger } from '../lib/logger';

export interface WorkerInput {
  workspace_id: string;
  thread_id: string;
  user_id: string;
  plan: PlanStep[];
  available_tools: Tool[];
}

export interface WorkerOutput {
  success: boolean;
  results: Record<string, any>[];
  error?: string;
  error_step?: number;
}

export class WorkerService {
  constructor(
    private db: Pool,
    private toolService: ToolService,
    private auditLogService: AuditLogService
  ) {}

  /**
   * Execute the plan step by step
   */
  async execute(input: WorkerInput): Promise<WorkerOutput> {
    const startTime = Date.now();
    const results: Record<string, any>[] = [];

    try {
      logger.info(`[Worker] Starting execution with ${input.plan.length} steps for workspace ${input.workspace_id}`);

      // Execute each step in the plan
      for (let i = 0; i < input.plan.length; i++) {
        const step = input.plan[i];

        try {
          logger.info(`[Worker] Executing step ${step.step}: ${step.action}`);

          // Step 1: Verify tool permission
          const hasPermission = step.tool ? await this.verifyToolPermission(input.workspace_id, step.tool) : true;

          if (!hasPermission) {
            logger.warn(`[Worker] Permission denied for tool: ${step.tool}`);

            await this.auditLogService.createAuditLog({
              workspace_id: input.workspace_id,
              thread_id: input.thread_id,
              user_id: input.user_id,
              agent_role: 'Worker',
              action_type: 'PERMISSION_CHECK',
              input_data: { step: step.step, tool: step.tool },
              status: 'failed',
              error_message: `Permission denied for tool ${step.tool}`,
            });

            return {
              success: false,
              results,
              error: `Tool ${step.tool} not allowed for this workspace`,
              error_step: step.step,
            };
          }

          // Step 2: Get tool details
          const tool = input.available_tools.find((t) => t.key === step.tool);

          if (!tool) {
            logger.warn(`[Worker] Tool not found: ${step.tool}`);

            await this.auditLogService.createAuditLog({
              workspace_id: input.workspace_id,
              thread_id: input.thread_id,
              user_id: input.user_id,
              agent_role: 'Worker',
              action_type: 'TOOL_EXECUTION',
              input_data: { step: step.step, tool: step.tool },
              status: 'failed',
              error_message: `Tool ${step.tool} not found`,
            });

            return {
              success: false,
              results,
              error: `Tool ${step.tool} not found`,
              error_step: step.step,
            };
          }

          // Step 3: Execute tool (simulated - in production, call actual tool API)
          const stepResult = await this.executeTool(step, tool);

          logger.info(`[Worker] Step ${step.step} completed`);

          // Step 4: Log execution
          await this.auditLogService.createAuditLog({
            workspace_id: input.workspace_id,
            thread_id: input.thread_id,
            user_id: input.user_id,
            agent_role: 'Worker',
            action_type: 'TOOL_EXECUTION',
            input_data: { step: step.step, tool: step.tool, params: step.params },
            output_data: stepResult,
            status: 'success',
            metadata: {
              step_number: step.step,
              execution_time_ms: Date.now() - startTime,
            },
          });

          results.push({
            step: step.step,
            tool: step.tool,
            result: stepResult,
            status: 'success',
          });
        } catch (stepError) {
          logger.error(`[Worker] Step ${step.step} failed: ${stepError}`);

          await this.auditLogService.createAuditLog({
            workspace_id: input.workspace_id,
            thread_id: input.thread_id,
            user_id: input.user_id,
            agent_role: 'Worker',
            action_type: 'TOOL_EXECUTION',
            input_data: { step: step.step, tool: step.tool },
            status: 'failed',
            error_message: String(stepError),
            metadata: {
              step_number: step.step,
            },
          });

          return {
            success: false,
            results,
            error: `Step ${step.step} failed: ${stepError}`,
            error_step: step.step,
          };
        }
      }

      logger.info(`[Worker] All steps completed successfully`);

      await this.auditLogService.createAuditLog({
        workspace_id: input.workspace_id,
        thread_id: input.thread_id,
        user_id: input.user_id,
        agent_role: 'Worker',
        action_type: 'EXECUTION_COMPLETE',
        input_data: { total_steps: input.plan.length },
        output_data: { results_count: results.length },
        status: 'success',
        metadata: {
          total_duration_ms: Date.now() - startTime,
          steps_completed: input.plan.length,
        },
      });

      return {
        success: true,
        results,
      };
    } catch (error) {
      logger.error(`[Worker] Execution failed: ${error}`);

      await this.auditLogService.createAuditLog({
        workspace_id: input.workspace_id,
        thread_id: input.thread_id,
        user_id: input.user_id,
        agent_role: 'Worker',
        action_type: 'EXECUTION_ERROR',
        status: 'failed',
        error_message: String(error),
      });

      return {
        success: false,
        results,
        error: String(error),
      };
    }
  }

  /**
   * Verify that workspace can use the tool
   */
  private async verifyToolPermission(workspaceId: string, toolKey: string): Promise<boolean> {
    try {
      // Query Neo4j for CAN_USE relationship
      const tool = await this.toolService.getToolByKey(toolKey);

      if (!tool) {
        return false;
      }

      // In production, query Neo4j to verify (Workspace)-[:CAN_USE]->(Tool)
      // For now, assume permission check passes - real implementation:
      // MATCH (w:Workspace {id: $workspaceId})-[:CAN_USE]->(t:Tool {key: $toolKey})
      // RETURN COUNT(*) > 0

      return true;
    } catch (error) {
      logger.error(`[Worker] Permission verification failed: ${error}`);
      return false;
    }
  }

  /**
   * Execute a single tool (simulated)
   * In production, this would call the actual tool API
   */
  private async executeTool(step: PlanStep, tool: Tool): Promise<Record<string, any>> {
    try {
      logger.info(`[Worker] Executing tool: ${tool.key}`);

      // Simulate tool execution based on tool type
      const result = await this.simulateToolExecution(tool, step.params);

      return {
        tool_key: tool.key,
        tool_name: tool.name,
        success: true,
        output: result,
        executed_at: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`[Worker] Tool execution failed: ${error}`);
      throw error;
    }
  }

  /**
   * Simulate tool execution (for testing)
   * In production, replace with actual tool API calls
   */
  private async simulateToolExecution(tool: Tool, params?: Record<string, any>): Promise<any> {
    // Simulate different tool behaviors
    const toolKey = tool.key.toLowerCase();

    if (toolKey.includes('email')) {
      return {
        status: 'sent',
        message_id: `msg_${Date.now()}`,
        recipients: params?.to || 'unknown',
      };
    }

    if (toolKey.includes('calendar')) {
      return {
        status: 'created',
        event_id: `evt_${Date.now()}`,
        title: params?.title || 'Event',
      };
    }

    if (toolKey.includes('spreadsheet')) {
      return {
        status: 'updated',
        sheet_id: params?.sheet_id || 'default',
        rows_affected: Math.floor(Math.random() * 100),
      };
    }

    if (toolKey.includes('slack')) {
      return {
        status: 'sent',
        channel: params?.channel || 'general',
        message_ts: Date.now().toString(),
      };
    }

    // Default response
    return {
      status: 'completed',
      tool: tool.key,
      params: params,
    };
  }
}
