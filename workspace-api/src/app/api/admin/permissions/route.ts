/**
 * POST /api/admin/permissions
 * 
 * Create workspace tool permissions
 * Grant a workspace access to a tool
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { CreatePermissionRequest, CreatePermissionResponse } from '@/types';
import { ToolService, AuditLogService } from '@/services';
import { neo4jClient } from '@/lib/neo4j';
import { logger } from '@/lib/logger';

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function POST(req: NextRequest): Promise<NextResponse<CreatePermissionResponse>> {
  try {
    const body: CreatePermissionRequest = await req.json();
    const { workspace_id, tool_key } = body;

    logger.info(`[API] POST /api/admin/permissions - workspace: ${workspace_id}, tool: ${tool_key}`);

    // Validation
    if (!workspace_id || !tool_key) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: workspace_id, tool_key',
        },
        { status: 400 }
      );
    }

    // Initialize services
    const toolService = new ToolService(db);
    const auditLogService = new AuditLogService(db);

    // Verify tool exists
    const tool = await toolService.getToolByKey(tool_key);

    if (!tool) {
      return NextResponse.json(
        {
          success: false,
          error: `Tool ${tool_key} not found`,
        },
        { status: 404 }
      );
    }

    // Create permission in Neo4j
    await neo4jClient.createToolPermission(workspace_id, tool_key);

    // Log audit
    await auditLogService.createAuditLog({
      workspace_id,
      agent_role: 'Observer',
      action_type: 'PERMISSION_GRANTED',
      input_data: { tool_key },
      output_data: { relationship_type: 'CAN_USE' },
      status: 'success',
    });

    const response: CreatePermissionResponse = {
      success: true,
      relationship_id: `${workspace_id}:CAN_USE:${tool_key}`,
    };

    logger.info(`[API] Permission granted: workspace ${workspace_id} can use tool ${tool_key}`);

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    logger.error(`[API] POST /api/admin/permissions error: ${error}`);

    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
