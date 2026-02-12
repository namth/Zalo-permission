/**
 * POST /api/agent/learn-skill
 * 
 * Create a new skill from user instruction
 * Used by n8n to learn new procedures
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { LearnSkillRequest, LearnSkillResponse } from '@/types';
import { SkillService, AuditLogService } from '@/services';
import { neo4jClient } from '@/lib/neo4j';
import { logger } from '@/lib/logger';

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function POST(req: NextRequest): Promise<NextResponse<LearnSkillResponse>> {
  try {
    const body: LearnSkillRequest = await req.json();
    const { workspace_id, owner_id, name, description, logic_config, is_shared } = body;

    logger.info(`[API] POST /api/agent/learn-skill - skill: ${name}, owner: ${owner_id}`);

    // Validation
    if (!workspace_id || !owner_id || !name || !logic_config || !Array.isArray(logic_config)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: workspace_id, owner_id, name, logic_config (array)',
        },
        { status: 400 }
      );
    }

    if (logic_config.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'logic_config must contain at least one step',
        },
        { status: 400 }
      );
    }

    // Initialize services
    const skillService = new SkillService(db, neo4jClient);
    const auditLogService = new AuditLogService(db);

    // Create skill
    const skill = await skillService.createSkill({
      workspace_id,
      owner_id,
      name,
      description,
      logic_config,
      is_shared: is_shared ?? false,
    });

    // Log audit
    await auditLogService.createAuditLog({
      workspace_id,
      user_id: owner_id,
      agent_role: 'Planner',
      action_type: 'SKILL_LEARNED',
      input_data: { skill_name: name, steps: logic_config.length },
      output_data: { skill_id: skill.id },
      status: 'success',
      metadata: {
        is_shared: skill.is_shared,
      },
    });

    const response: LearnSkillResponse = {
      success: true,
      skill_id: skill.id,
    };

    logger.info(`[API] Skill ${skill.id} learned successfully`);

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    logger.error(`[API] POST /api/agent/learn-skill error: ${error}`);

    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
