import { NextRequest, NextResponse } from 'next/server';
import { PermissionSyncService } from '@/services/sync.service';
import { AuditLogService } from '@/services';
import { getDb, query } from '@/lib/db';
import { executeQuery } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/permissions
 * Returns permission matrix: all workspaces, all tools, and CAN_USE relationships
 */
export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    // Get all workspaces
    const workspacesResult = await query(
      `SELECT id, name, created_at FROM workspaces ORDER BY name ASC`
    );

    // Get all active tools
    const toolsResult = await query(
      `SELECT id, key, name, status FROM tools WHERE status = 'active' ORDER BY name ASC`
    );

    // Get all CAN_USE relationships from Neo4j
    let permissions: any[] = [];
    try {
      const neo4jResult = await executeQuery(
        `MATCH (w:Workspace)-[:CAN_USE]->(t:Tool)
         RETURN w.id as workspace_id, t.key as tool_key, t.id as tool_id`,
        {}
      );
      permissions = neo4jResult.records.map(r => ({
        workspace_id: r.get('workspace_id'),
        tool_key: r.get('tool_key'),
        tool_id: r.get('tool_id'),
      }));
    } catch (neo4jErr) {
      logger.warn(`Could not fetch permissions from Neo4j: ${neo4jErr}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        workspaces: workspacesResult.rows,
        tools: toolsResult.rows,
        permissions,
      },
    }, { status: 200 });
  } catch (error) {
    logger.error(`GET /api/admin/permissions error: ${error}`);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}


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
