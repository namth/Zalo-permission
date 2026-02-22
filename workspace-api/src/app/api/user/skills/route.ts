/**
 * /api/user/skills
 * 
 * Manage user skills
 * GET: List user's skills
 * POST: Share skill with workspace
 * DELETE: Delete a skill
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { ListSkillsRequest, ListSkillsResponse, ShareSkillRequest, ShareSkillResponse } from '@/types';
import { SkillService, AuditLogService } from '@/services';
import { neo4jClient } from '@/lib/neo4j';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(req: NextRequest): Promise<NextResponse<ListSkillsResponse>> {
  try {
    const userId = req.nextUrl.searchParams.get('user_id');
    const workspaceId = req.nextUrl.searchParams.get('workspace_id');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0', 10);

    logger.info(`[API] GET /api/user/skills - user: ${userId}, limit: ${limit}`);

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          skills: [],
          error: 'Missing required query parameter: user_id',
        },
        { status: 400 }
      );
    }

    // Initialize service
    const skillService = new SkillService(db, neo4jClient);

    // Get user's skills
    const result = await skillService.listSkillsByOwner(userId, limit, offset);

    const response: ListSkillsResponse = {
      success: true,
      skills: result.skills,
      pagination: {
        limit,
        offset,
        total: result.total,
        hasMore: offset + limit < result.total,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    logger.error(`[API] GET /api/user/skills error: ${error}`);

    return NextResponse.json(
      {
        success: false,
        skills: [],
        error: String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<ShareSkillResponse>> {
  try {
    const body: ShareSkillRequest = await req.json();
    const { skill_id, workspace_id } = body;

    logger.info(`[API] POST /api/user/skills/share - skill: ${skill_id}, workspace: ${workspace_id}`);

    // Get user_id from query or body
    const userId = req.nextUrl.searchParams.get('user_id');

    if (!skill_id || !workspace_id || !userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: skill_id, workspace_id, user_id (query param)',
        },
        { status: 400 }
      );
    }

    // Initialize services
    const skillService = new SkillService(db, neo4jClient);
    const auditLogService = new AuditLogService(db);

    // Share skill
    await skillService.shareSkill(skill_id, workspace_id, userId);

    // Log audit
    await auditLogService.createAuditLog({
      workspace_id,
      user_id: userId,
      action_type: 'SKILL_SHARED',
      input_data: { skill_id },
      output_data: { relationship_type: 'SHARED_TO' },
      status: 'success',
    });

    const response: ShareSkillResponse = {
      success: true,
    };

    logger.info(`[API] Skill ${skill_id} shared with workspace ${workspace_id}`);

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    logger.error(`[API] POST /api/user/skills/share error: ${error}`);

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
    const skillId = req.nextUrl.searchParams.get('skill_id');
    const userId = req.nextUrl.searchParams.get('user_id');

    logger.info(`[API] DELETE /api/user/skills - skill: ${skillId}, user: ${userId}`);

    if (!skillId || !userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required query parameters: skill_id, user_id',
        },
        { status: 400 }
      );
    }

    // Initialize services
    const skillService = new SkillService(db, neo4jClient);
    const auditLogService = new AuditLogService(db);

    // Delete skill
    await skillService.deleteSkill(skillId, userId);

    // Log audit
    await auditLogService.createAuditLog({
      workspace_id: 'unknown',
      user_id: userId,
      action_type: 'SKILL_DELETED',
      input_data: { skill_id: skillId },
      status: 'success',
    });

    logger.info(`[API] Skill ${skillId} deleted`);

    return NextResponse.json(
      {
        success: true,
        message: 'Skill deleted successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error(`[API] DELETE /api/user/skills error: ${error}`);

    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
