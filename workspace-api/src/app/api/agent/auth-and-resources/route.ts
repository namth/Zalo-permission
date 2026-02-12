/**
 * POST /api/agent/auth-and-resources
 * 
 * Authenticate user and provide authorized tools/skills list
 * Used by n8n Planner agent to get available resources
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { AuthAndResourcesRequest, AuthAndResourcesResponse, ErrorCode, ApiError } from '@/types';
import {
  PendingTaskService,
  ToolService,
  SkillService,
  AuditLogService,
} from '@/services';
import { neo4jClient } from '@/lib/neo4j';
import { logger } from '@/lib/logger';

// Database connection pool (assuming global pool instance)
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function POST(req: NextRequest): Promise<NextResponse<AuthAndResourcesResponse>> {
  try {
    const body: AuthAndResourcesRequest = await req.json();
    const { thread_id, user_id, workspace_id } = body;

    logger.info(`[API] POST /api/agent/auth-and-resources - user: ${user_id}, thread: ${thread_id}`);

    // Validation
    if (!thread_id || !user_id) {
      return NextResponse.json(
        {
          success: false,
          workspace_id: '',
          user_role: 'member' as const,
          available_tools: [],
          available_skills: [],
          error: 'Missing required fields: thread_id, user_id',
        },
        { status: 400 }
      );
    }

    // Step 1: Get authorization context from Neo4j
    const authContext = await neo4jClient.getAuthorizationContext(user_id, thread_id);

    if (!authContext) {
      logger.warn(`User ${user_id} not authorized for thread ${thread_id}`);

      return NextResponse.json(
        {
          success: false,
          workspace_id: '',
          user_role: 'member' as const,
          available_tools: [],
          available_skills: [],
          error: ErrorCode.USER_NOT_MEMBER,
        },
        { status: 403 }
      );
    }

    const resolvedWorkspaceId = workspace_id || authContext.workspaceId;
    const userRole = authContext.role as 'admin' | 'member';

    // Step 2: Initialize services
    const pendingTaskService = new PendingTaskService(db);
    const toolService = new ToolService(db);
    const skillService = new SkillService(db, neo4jClient);
    const auditLogService = new AuditLogService(db);

    // Step 3: Check for pending tasks
    const pendingTask = await pendingTaskService.getPendingTaskByThreadAndUser(
      thread_id,
      user_id,
      resolvedWorkspaceId
    );

    logger.info(`Pending task: ${pendingTask ? 'found' : 'not found'}`);

    // Step 4: Get available tools for workspace
    const availableTools = await Promise.all(
      authContext.availableTools.map((toolKey) => toolService.getToolByKey(toolKey))
    ).then((tools) => tools.filter((t): t is any => t !== null));

    // Step 5: Get available skills for workspace
    const availableSkills = await Promise.all(
      authContext.availableSkills.map((skillId) => skillService.getSkillById(skillId))
    ).then((skills) => skills.filter((s): s is any => s !== null));

    // Log audit
    await auditLogService.createAuditLog({
      workspace_id: resolvedWorkspaceId,
      thread_id,
      user_id,
      agent_role: 'Planner',
      action_type: 'AUTH_AND_RESOURCES',
      input_data: { user_id, thread_id },
      output_data: {
        tools_count: availableTools.length,
        skills_count: availableSkills.length,
        has_pending_task: !!pendingTask,
      },
      status: 'success',
    });

    const response: AuthAndResourcesResponse = {
      success: true,
      workspace_id: resolvedWorkspaceId,
      user_role: userRole,
      pending_task: pendingTask || undefined,
      available_tools: availableTools,
      available_skills: availableSkills,
    };

    logger.info(
      `[API] Auth successful. Tools: ${availableTools.length}, Skills: ${availableSkills.length}`
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    logger.error(`[API] POST /api/agent/auth-and-resources error: ${error}`);

    return NextResponse.json(
      {
        success: false,
        workspace_id: '',
        user_role: 'member' as const,
        available_tools: [],
        available_skills: [],
        error: String(error),
      },
      { status: 500 }
    );
  }
}
