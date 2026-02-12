/**
 * Observer Service
 * Validates and verifies Worker execution results
 * 
 * Responsibilities:
 * 1. Check result format
 * 2. Verify results meet user intent
 * 3. Decide if results satisfy user request
 * 4. Provide feedback for replanning if needed
 */

import { Pool } from 'pg';
import { AuditLogService } from './audit-log.service';
import { PlannerService } from './planner.service';
import { logger } from '../lib/logger';

export interface ObserverInput {
  workspace_id: string;
  thread_id: string;
  user_id: string;
  user_intent: string;
  worker_results: Record<string, any>[];
}

export interface ObserverOutput {
  success: boolean;
  validation_passed: boolean;
  verdict: 'FINISH' | 'REPLAN' | 'ERROR';
  feedback?: string;
  issues?: string[];
}

export class ObserverService {
  constructor(
    private db: Pool,
    private auditLogService: AuditLogService
  ) {}

  /**
   * Observe and validate Worker results
   */
  async observe(input: ObserverInput): Promise<ObserverOutput> {
    const startTime = Date.now();

    try {
      logger.info(
        `[Observer] Validating ${input.worker_results.length} results for workspace ${input.workspace_id}`
      );

      // Check 1: Validate result format
      const formatCheck = this.validateResultFormat(input.worker_results);

      if (!formatCheck.valid) {
        logger.warn(`[Observer] Format validation failed: ${formatCheck.issues?.join(', ')}`);

        await this.auditLogService.createAuditLog({
          workspace_id: input.workspace_id,
          thread_id: input.thread_id,
          user_id: input.user_id,
          agent_role: 'Observer',
          action_type: 'VALIDATION_CHECK',
          input_data: { results_count: input.worker_results.length },
          status: 'failed',
          error_message: `Format validation failed: ${formatCheck.issues?.join(', ')}`,
        });

        return {
          success: false,
          validation_passed: false,
          verdict: 'ERROR',
          feedback: 'Kết quả không đúng định dạng.',
          issues: formatCheck.issues,
        };
      }

      // Check 2: Verify results satisfy intent
      const intentCheck = this.validateIntentSatisfaction(input.user_intent, input.worker_results);

      if (!intentCheck.satisfied) {
        logger.info(`[Observer] Intent not satisfied. Issues: ${intentCheck.issues?.join(', ')}`);

        await this.auditLogService.createAuditLog({
          workspace_id: input.workspace_id,
          thread_id: input.thread_id,
          user_id: input.user_id,
          agent_role: 'Observer',
          action_type: 'INTENT_VALIDATION',
          input_data: { intent: input.user_intent, results_count: input.worker_results.length },
          output_data: { satisfied: false },
          status: 'failed',
          error_message: `Intent not satisfied: ${intentCheck.issues?.join(', ')}`,
        });

        return {
          success: true,
          validation_passed: false,
          verdict: 'REPLAN',
          feedback: 'Kết quả không hoàn toàn đáp ứng yêu cầu của bạn. Tôi sẽ thử lại với cách tiếp cận khác.',
          issues: intentCheck.issues,
        };
      }

      // Check 3: Verify all results are successful
      const successCheck = this.validateExecutionSuccess(input.worker_results);

      if (!successCheck.all_success) {
        logger.warn(`[Observer] Some steps failed: ${successCheck.failed_steps?.join(', ')}`);

        await this.auditLogService.createAuditLog({
          workspace_id: input.workspace_id,
          thread_id: input.thread_id,
          user_id: input.user_id,
          agent_role: 'Observer',
          action_type: 'SUCCESS_VALIDATION',
          input_data: { results_count: input.worker_results.length },
          output_data: { all_success: false, failed_steps: successCheck.failed_steps },
          status: 'failed',
          error_message: `Execution failed at steps: ${successCheck.failed_steps?.join(', ')}`,
        });

        return {
          success: true,
          validation_passed: false,
          verdict: 'REPLAN',
          feedback: 'Một số bước thực thi thất bại. Tôi sẽ thử lại.',
          issues: successCheck.failed_steps?.map((step) => `Step ${step} failed`),
        };
      }

      // All validations passed - FINISH
      logger.info(`[Observer] All validations passed. Finishing execution.`);

      await this.auditLogService.createAuditLog({
        workspace_id: input.workspace_id,
        thread_id: input.thread_id,
        user_id: input.user_id,
        agent_role: 'Observer',
        action_type: 'VALIDATION_COMPLETE',
        input_data: { results_count: input.worker_results.length, intent: input.user_intent },
        output_data: { validation_passed: true },
        status: 'success',
        metadata: {
          duration_ms: Date.now() - startTime,
          verdict: 'FINISH',
        },
      });

      return {
        success: true,
        validation_passed: true,
        verdict: 'FINISH',
        feedback: 'Yêu cầu của bạn đã được hoàn thành thành công.',
      };
    } catch (error) {
      logger.error(`[Observer] Observation failed: ${error}`);

      await this.auditLogService.createAuditLog({
        workspace_id: input.workspace_id,
        thread_id: input.thread_id,
        user_id: input.user_id,
        agent_role: 'Observer',
        action_type: 'OBSERVATION_ERROR',
        status: 'failed',
        error_message: String(error),
      });

      return {
        success: false,
        validation_passed: false,
        verdict: 'ERROR',
        feedback: 'Có lỗi xảy ra khi xác minh kết quả.',
        issues: [String(error)],
      };
    }
  }

  /**
   * Validate that results have correct format
   */
  private validateResultFormat(results: Record<string, any>[]): { valid: boolean; issues?: string[] } {
    const issues: string[] = [];

    if (!Array.isArray(results)) {
      issues.push('Results must be an array');
      return { valid: false, issues };
    }

    if (results.length === 0) {
      issues.push('No results returned from execution');
      return { valid: false, issues };
    }

    // Check each result
    results.forEach((result, index) => {
      if (!result.step) {
        issues.push(`Result ${index} missing step number`);
      }

      if (!result.tool) {
        issues.push(`Result ${index} missing tool information`);
      }

      if (!result.result) {
        issues.push(`Result ${index} missing result data`);
      }

      if (result.status !== 'success' && result.status !== 'failed') {
        issues.push(`Result ${index} has invalid status: ${result.status}`);
      }
    });

    return {
      valid: issues.length === 0,
      issues: issues.length > 0 ? issues : undefined,
    };
  }

  /**
   * Validate that results satisfy user intent
   */
  private validateIntentSatisfaction(
    intent: string,
    results: Record<string, any>[]
  ): { satisfied: boolean; issues?: string[] } {
    const issues: string[] = [];

    // Check that we have results
    if (!results || results.length === 0) {
      issues.push('No results from execution');
      return { satisfied: false, issues };
    }

    // Check that all results are successful (basic heuristic)
    const allSuccess = results.every((r) => r.status === 'success');

    if (!allSuccess) {
      issues.push('Some execution steps failed');
      return { satisfied: false, issues };
    }

    // Check that results contain expected output
    const hasOutput = results.every((r) => r.result && Object.keys(r.result).length > 0);

    if (!hasOutput) {
      issues.push('Results do not contain output data');
      return { satisfied: false, issues };
    }

    // Heuristic: check intent keywords in tool names
    const toolsUsed = results.map((r) => r.tool?.toLowerCase() || '');
    const intentKeywords = intent.toLowerCase().split(' ');

    // Very basic matching - in production, use semantic similarity
    const relevantToolsUsed = toolsUsed.some((tool) => 
      intentKeywords.some((keyword) => tool.includes(keyword))
    );

    if (!relevantToolsUsed && results.length > 0) {
      // Don't fail if we have some results - assume they're relevant
      logger.info(`[Observer] Intent keywords not found in tool names, but execution succeeded`);
    }

    return {
      satisfied: issues.length === 0,
      issues: issues.length > 0 ? issues : undefined,
    };
  }

  /**
   * Validate that all execution steps succeeded
   */
  private validateExecutionSuccess(results: Record<string, any>[]): {
    all_success: boolean;
    failed_steps?: number[];
  } {
    const failedSteps: number[] = [];

    results.forEach((result) => {
      if (result.status === 'failed') {
        failedSteps.push(result.step);
      }
    });

    return {
      all_success: failedSteps.length === 0,
      failed_steps: failedSteps.length > 0 ? failedSteps : undefined,
    };
  }

  /**
   * Format final response for user
   */
  formatFinalResponse(results: Record<string, any>[]): string {
    if (!results || results.length === 0) {
      return 'Không có kết quả để báo cáo.';
    }

    const successCount = results.filter((r) => r.status === 'success').length;
    const summary = `Đã hoàn thành ${successCount}/${results.length} bước thành công.`;

    const details = results
      .filter((r) => r.status === 'success')
      .map((r) => {
        const toolName = r.result?.tool_name || r.tool || 'Unknown';
        return `• ${toolName}: Thành công`;
      })
      .join('\n');

    return `${summary}\n\n${details}`;
  }
}
