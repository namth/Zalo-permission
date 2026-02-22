/**
 * POST /api/admin/permissions
 * DELETE /api/admin/permissions
 * 
 * Manage workspace tool permissions with synchronized databases
 * POST: Grant a workspace access to a tool
 * DELETE: Revoke a workspace's access to a tool
 */

import { NextRequest, NextResponse } from 'next/server';
import { PermissionSyncService } from '@/services/sync.service';
import { AuditLogService } from '@/services';
import { getDb } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { workspace_id, tool_key, granted_by } = body;

    logger.info(
      `[API] POST /api/admin/permissions - workspace: ${workspace_id}, tool: ${tool_key}`
    );

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

    // Grant permission with full sync to PostgreSQL and Neo4j
    const result = await PermissionSyncService.grantToolPermission(
      workspace_id,
      tool_key,
      granted_by
    );

    // Log audit
    const db = getDb();
    const auditLogService = new AuditLogService(db);
    await auditLogService.createAuditLog({
      workspace_id,
      action_type: 'PERMISSION_GRANTED',
      input_data: { tool_key },
      output_data: { relationship_type: 'CAN_USE', tool_id: result.tool_id },
      status: 'success',
    });

    logger.info(
      `[API] Permission granted: workspace ${workspace_id} can use tool ${tool_key}`
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          workspace_id,
          tool_key,
          relationship_id: `${workspace_id}:CAN_USE:${tool_key}`,
          status: result.status,
        },
      },
      { status: result.status === 'already_exists' ? 200 : 201 }
    );
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

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { workspace_id, tool_key, revoked_by } = body;

    logger.info(
      `[API] DELETE /api/admin/permissions - workspace: ${workspace_id}, tool: ${tool_key}`
    );

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

    // Revoke permission with full sync to PostgreSQL and Neo4j
    const result = await PermissionSyncService.revokeToolPermission(
      workspace_id,
      tool_key,
      revoked_by
    );

    // Log audit
    const db = getDb();
    const auditLogService = new AuditLogService(db);
    await auditLogService.createAuditLog({
      workspace_id,
      action_type: 'PERMISSION_REVOKED',
      input_data: { tool_key },
      output_data: { relationship_type: 'CAN_USE' },
      status: 'success',
    });

    logger.info(
      `[API] Permission revoked: workspace ${workspace_id} can no longer use tool ${tool_key}`
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          workspace_id,
          tool_key,
          relationship_id: `${workspace_id}:CAN_USE:${tool_key}`,
          status: result.status,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error(`[API] DELETE /api/admin/permissions error: ${error}`);

    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
