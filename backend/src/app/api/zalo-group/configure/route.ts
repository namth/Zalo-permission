import { NextRequest, NextResponse } from 'next/server';
import { updateZaloGroupAgent } from '@/services/workspace.service';

/**
 * POST /api/zalo-group/configure
 * Configure agent for a Zalo Group
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { group_id, agent_key } = body;

    if (!group_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_PARAM',
          message: 'Missing required parameter: group_id'
        },
        { status: 400 }
      );
    }

    if (!agent_key) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_PARAM',
          message: 'Missing required parameter: agent_key'
        },
        { status: 400 }
      );
    }

    // Update agent_key
    await updateZaloGroupAgent(group_id, agent_key);

    return NextResponse.json(
      {
        success: true,
        message: 'Zalo group configured successfully'
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error configuring zalo group:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message || 'Internal server error'
      },
      { status: 500 }
    );
  }
}
