import { NextRequest, NextResponse } from 'next/server';
import { createAgent, listAgents, updateAgent, deleteAgent } from '@/services/agent.service';

/**
 * POST /api/admin/agents - Create agent
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.key || !body.name) {
      return NextResponse.json(
        { success: false, error: 'Missing key or name' },
        { status: 400 }
      );
    }

    const agent = await createAgent(body.key, body.name, body.description, body.created_by);

    return NextResponse.json({ success: true, data: agent }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating agent:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create agent' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/agents - List agents
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const { agents, total } = await listAgents(limit, offset);

    return NextResponse.json(
      {
        success: true,
        data: agents,
        pagination: { limit, offset, total, hasMore: offset + limit < total }
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error listing agents:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list agents' },
      { status: 500 }
    );
  }
}
