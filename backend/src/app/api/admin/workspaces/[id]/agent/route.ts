import { NextRequest, NextResponse } from 'next/server';
import { assignAgentToWorkspace, getWorkspaceAgentConfigs, updateAgentConfig } from '@/services/agent.service';

/**
 * POST /api/admin/workspaces/:id/agent - Assign agent to workspace
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    if (!body.agent_key) {
      return NextResponse.json(
        { success: false, error: 'Missing agent_key' },
        { status: 400 }
      );
    }

    const config = await assignAgentToWorkspace(
      params.id,
      body.agent_key,
      body.system_prompt,
      body.temperature,
      body.max_tokens,
      body.assigned_by
    );

    return NextResponse.json({ success: true, data: config }, { status: 201 });
  } catch (error: any) {
    console.error('Error assigning agent to workspace:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to assign agent' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/workspaces/:id/agent - Get workspace agent configs
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const configs = await getWorkspaceAgentConfigs(params.id);

    return NextResponse.json(
      { success: true, data: configs },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error getting workspace agent configs:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get agent configs' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/workspaces/:id/agent/:config_id - Update agent config
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    if (!body.config_id) {
      return NextResponse.json(
        { success: false, error: 'Missing config_id' },
        { status: 400 }
      );
    }

    const updated = await updateAgentConfig(
      body.config_id,
      {
        system_prompt: body.system_prompt,
        temperature: body.temperature,
        max_tokens: body.max_tokens
      },
      body.updated_by
    );

    return NextResponse.json({ success: true, data: updated }, { status: 200 });
  } catch (error: any) {
    console.error('Error updating agent config:', error);

    if (error.message.includes('not found')) {
      return NextResponse.json(
        { success: false, error: 'Config not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update config' },
      { status: 500 }
    );
  }
}
