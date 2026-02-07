import { NextRequest, NextResponse } from 'next/server';
import { listAgents } from '@/services/agent.service';

/**
 * GET /api/agents - List all agents
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    const result = await listAgents(limit, offset);

    return NextResponse.json(
      { success: true, data: result.agents },
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
