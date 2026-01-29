import { NextRequest, NextResponse } from 'next/server';
import { getAgent, updateAgent, deleteAgent } from '@/services/agent.service';

/**
 * GET /api/admin/agents/:key - Get agent
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const agent = await getAgent(params.key);

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: agent }, { status: 200 });
  } catch (error: any) {
    console.error('Error getting agent:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get agent' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/agents/:key - Update agent
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const body = await request.json();

    const agent = await updateAgent(
      params.key,
      { name: body.name, description: body.description },
      body.updated_by
    );

    return NextResponse.json({ success: true, data: agent }, { status: 200 });
  } catch (error: any) {
    console.error('Error updating agent:', error);

    if (error.message.includes('not found')) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update agent' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/agents/:key - Delete agent
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const body = await request.json().catch(() => ({}));

    await deleteAgent(params.key, body.deleted_by);

    return NextResponse.json(
      { success: true, message: 'Agent deleted' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting agent:', error);

    if (error.message.includes('not found')) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    if (error.message.includes('used in workspaces')) {
      return NextResponse.json(
        { success: false, error: 'Agent is used in workspaces, cannot delete' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete agent' },
      { status: 500 }
    );
  }
}
