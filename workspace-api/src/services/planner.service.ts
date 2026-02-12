/**
 * Planner Service
 * Orchestrates the planning phase of the AI Agent System
 * 
 * Workflow:
 * 1. Check persistence (pending tasks)
 * 2. Verify authorization via Neo4j
 * 3. Retrieve resources (tools & skills)
 * 4. Reason & decide (ask for input or proceed)
 * 5. Update pending tasks or pass to Worker
 */

import { Pool } from 'pg';
import { PlanStep, PendingTask, Tool, Skill, AuthAndResourcesResponse } from '../types';
import { PendingTaskService } from './pending-task.service';
import { ToolService } from './tool.service';
import { SkillService } from './skill.service';
import { AuditLogService } from './audit-log.service';
import { neo4jClient } from '../lib/neo4j';
import { embeddingClient } from '../lib/embedding';
import { logger } from '../lib/logger';

export interface PlannerInput {
  thread_id: string;
  user_id: string;
  user_message: string;
  workspace_id?: string;
}

export interface PlannerOutput {
  success: boolean;
  action: 'ASK_FOR_INPUT' | 'PROCEED_TO_WORKER' | 'ERROR';
  workspace_id?: string;
  user_role?: string;
  pending_task?: PendingTask;
  full_plan?: PlanStep[];
  missing_parameters?: Record<string, string>;
  available_tools?: Tool[];
  available_skills?: Skill[];
  response_message?: string;
  error?: string;
}

export class PlannerService {
  constructor(
    private db: Pool,
    private pendingTaskService: PendingTaskService,
    private toolService: ToolService,
    private skillService: SkillService,
    private auditLogService: AuditLogService
  ) {}

  /**
   * Main planning workflow
   */
  async plan(input: PlannerInput): Promise<PlannerOutput> {
    const startTime = Date.now();

    try {
      logger.info(`[Planner] Starting planning for user ${input.user_id} in thread ${input.thread_id}`);

      // Step 1: Get authorization context
      const authContext = await neo4jClient.getAuthorizationContext(input.user_id, input.thread_id);

      if (!authContext) {
        logger.warn(`[Planner] User ${input.user_id} not authorized for thread ${input.thread_id}`);

        await this.auditLogService.createAuditLog({
          workspace_id: input.workspace_id || 'unknown',
          thread_id: input.thread_id,
          user_id: input.user_id,
          agent_role: 'Planner',
          action_type: 'AUTHORIZATION_CHECK',
          input_data: { user_id: input.user_id, thread_id: input.thread_id },
          status: 'failed',
          error_message: 'User not authorized',
        });

        return {
          success: false,
          action: 'ERROR',
          error: 'User not authorized for this workspace',
          response_message: 'Xin lỗi, bạn không có quyền truy cập nhóm này.',
        };
      }

      const workspaceId = authContext.workspaceId;
      const userRole = authContext.role;

      // Step 2: Check persistence - get pending tasks
      const existingTask = await this.pendingTaskService.getPendingTaskByThreadAndUser(
        input.thread_id,
        input.user_id,
        workspaceId
      );

      logger.info(`[Planner] Checking persistence: ${existingTask ? 'found pending task' : 'no existing task'}`);

      // Step 3: Retrieve resources
      const availableTools = await Promise.all(
        authContext.availableTools.map((toolKey) => this.toolService.getToolByKey(toolKey))
      ).then((tools) => tools.filter((t): t is Tool => t !== null));

      const availableSkills = await Promise.all(
        authContext.availableSkills.map((skillId) => this.skillService.getSkillById(skillId))
      ).then((skills) => skills.filter((s): s is Skill => s !== null));

      logger.info(
        `[Planner] Retrieved ${availableTools.length} tools and ${availableSkills.length} skills from authorization context`
      );

      // Step 4: Semantic search for most relevant tools/skills
      const relevantTools = await this.toolService.searchToolsByEmbedding(input.user_message, workspaceId, 5);
      const relevantSkills = await this.skillService.searchSkillsByEmbedding(input.user_message, workspaceId, 5);

      logger.info(
        `[Planner] Semantic search returned ${relevantTools.length} tools and ${relevantSkills.length} skills`
      );

      // Step 5: Analyze and decide
      const decision = await this.analyzeAndDecide(
        input,
        existingTask,
        availableTools,
        availableSkills,
        relevantTools,
        relevantSkills
      );

      // Step 6: Execute decision
      let response: PlannerOutput;

      if (decision.action === 'ASK_FOR_INPUT') {
        // Save pending task
        await this.pendingTaskService.upsertPendingTask({
          workspace_id: workspaceId,
          thread_id: input.thread_id,
          user_id: input.user_id,
          intent: input.user_message,
          full_plan: decision.full_plan,
          missing_parameters: decision.missing_parameters,
          status: 'AWAITING_INPUT',
        });

        response = {
          success: true,
          action: 'ASK_FOR_INPUT',
          workspace_id: workspaceId,
          user_role: userRole,
          missing_parameters: decision.missing_parameters,
          response_message: this.buildMissingInfoMessage(decision.missing_parameters || {}),
          available_tools: availableTools,
          available_skills: availableSkills,
        };

        logger.info(`[Planner] Decision: ASK_FOR_INPUT. Missing: ${JSON.stringify(decision.missing_parameters)}`);
      } else {
        // Proceed to Worker
        response = {
          success: true,
          action: 'PROCEED_TO_WORKER',
          workspace_id: workspaceId,
          user_role: userRole,
          pending_task: existingTask || undefined,
          full_plan: decision.full_plan,
          available_tools: availableTools,
          available_skills: availableSkills,
          response_message: 'Tôi sẽ bắt đầu thực hiện yêu cầu của bạn...',
        };

        logger.info(`[Planner] Decision: PROCEED_TO_WORKER with plan of ${decision.full_plan?.length || 0} steps`);
      }

      // Log to audit
      await this.auditLogService.createAuditLog({
        workspace_id: workspaceId,
        thread_id: input.thread_id,
        user_id: input.user_id,
        agent_role: 'Planner',
        action_type: 'PLANNING_COMPLETE',
        input_data: { user_message: input.user_message },
        output_data: { action: decision.action, planSteps: decision.full_plan?.length },
        status: 'success',
        metadata: {
          duration_ms: Date.now() - startTime,
          tools_available: availableTools.length,
          skills_available: availableSkills.length,
        },
      });

      return response;
    } catch (error) {
      logger.error(`[Planner] Planning failed: ${error}`);

      await this.auditLogService.createAuditLog({
        workspace_id: input.workspace_id || 'unknown',
        thread_id: input.thread_id,
        user_id: input.user_id,
        agent_role: 'Planner',
        action_type: 'PLANNING_ERROR',
        input_data: { user_message: input.user_message },
        status: 'failed',
        error_message: String(error),
      });

      return {
        success: false,
        action: 'ERROR',
        error: String(error),
        response_message: 'Xin lỗi, có lỗi xảy ra khi xử lý yêu cầu của bạn.',
      };
    }
  }

  /**
   * Analyze user message and decide next action
   * This is a simplified version - in production, you'd use LLM reasoning
   */
  private async analyzeAndDecide(
    input: PlannerInput,
    existingTask: PendingTask | null,
    availableTools: Tool[],
    availableSkills: Skill[],
    relevantTools: Tool[],
    relevantSkills: Skill[]
  ): Promise<{
    action: 'ASK_FOR_INPUT' | 'PROCEED_TO_WORKER';
    full_plan?: PlanStep[];
    missing_parameters?: Record<string, string>;
  }> {
    // If there's an existing task, check if new message provides missing info
    if (existingTask && existingTask.status === 'AWAITING_INPUT') {
      const hasMissingInfo = existingTask.missing_parameters && Object.keys(existingTask.missing_parameters).length > 0;

      if (hasMissingInfo) {
        // Check if new message looks like it contains parameter values
        // This is a simplified check - in production, use LLM to extract values
        const containsLikelyValues = this.extractParameterValues(
          input.user_message,
          existingTask.missing_parameters || {}
        );

        if (Object.keys(containsLikelyValues).length > 0) {
          // Merge with existing plan
          const updatedPlan = this.updatePlanWithValues(existingTask.full_plan, containsLikelyValues);

          return {
            action: 'PROCEED_TO_WORKER',
            full_plan: updatedPlan,
          };
        }
      }
    }

    // Create new plan from scratch if no existing task
    if (!existingTask) {
      // Select relevant tools/skills for the plan
      const selectedTools = relevantTools.slice(0, 3); // Top 3 most relevant
      const selectedSkills = relevantSkills.slice(0, 2);

      // Create basic plan structure
      const plan: PlanStep[] = [];

      // Add tool usage steps
      selectedTools.forEach((tool, index) => {
        plan.push({
          step: index + 1,
          tool: tool.key,
          action: `Use ${tool.name}`,
          required_params: this.extractRequiredParams(tool),
        });
      });

      // Check for missing required parameters
      const missingParams = this.validatePlanParameters(plan, input.user_message);

      if (Object.keys(missingParams).length > 0) {
        return {
          action: 'ASK_FOR_INPUT',
          full_plan: plan,
          missing_parameters: missingParams,
        };
      }

      return {
        action: 'PROCEED_TO_WORKER',
        full_plan: plan,
      };
    }

    // Default: ask for input
    return {
      action: 'ASK_FOR_INPUT',
      full_plan: existingTask.full_plan,
      missing_parameters: existingTask.missing_parameters,
    };
  }

  /**
   * Extract parameter values from user message
   */
  private extractParameterValues(message: string, missingParams: Record<string, string>): Record<string, string> {
    const extracted: Record<string, string> = {};

    // Simple heuristic: look for parameter names in the message
    for (const [param] of Object.entries(missingParams)) {
      if (message.toLowerCase().includes(param.toLowerCase())) {
        extracted[param] = message;
      }
    }

    return extracted;
  }

  /**
   * Update plan with extracted parameter values
   */
  private updatePlanWithValues(plan: PlanStep[] | undefined, values: Record<string, string>): PlanStep[] {
    if (!plan) {
      return [];
    }

    return plan.map((step) => ({
      ...step,
      params: {
        ...step.params,
        ...values,
      },
    }));
  }

  /**
   * Extract required parameters from tool input schema
   */
  private extractRequiredParams(tool: Tool): string[] {
    if (!tool.input_schema) {
      return [];
    }

    if (typeof tool.input_schema === 'string') {
      try {
        const schema = JSON.parse(tool.input_schema);
        return schema.required || [];
      } catch {
        return [];
      }
    }

    return (tool.input_schema as any).required || [];
  }

  /**
   * Validate if plan has all required parameters
   */
  private validatePlanParameters(plan: PlanStep[], message: string): Record<string, string> {
    const missing: Record<string, string> = {};

    plan.forEach((step) => {
      if (step.required_params && step.required_params.length > 0) {
        step.required_params.forEach((param) => {
          // Check if parameter value is in the message
          if (!message.toLowerCase().includes(param.toLowerCase())) {
            missing[param] = `Missing required parameter: ${param}`;
          }
        });
      }
    });

    return missing;
  }

  /**
   * Build a friendly message asking for missing information
   */
  private buildMissingInfoMessage(missingParams: Record<string, string>): string {
    const paramList = Object.keys(missingParams)
      .map((param) => `• ${param}`)
      .join('\n');

    return `Tôi cần thêm các thông tin sau để tiếp tục:\n${paramList}\n\nVui lòng cung cấp thông tin này.`;
  }
}
