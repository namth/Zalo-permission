import { NextRequest, NextResponse } from 'next/server';
import { resolveWorkspaceContext } from '@/services/policy.service';

/**
 * POST /api/agent/resolve-context
 * Resolve workspace context for AI Agent (main permission check)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.thread_id || !body.zalo_user_id) {
      return NextResponse.json(
        {
          allowed: false,
          error: 'MISSING_PARAM',
          message: 'Missing thread_id or zalo_user_id'
        },
        { status: 400 }
      );
    }

    const context = await resolveWorkspaceContext(body.thread_id, body.zalo_user_id);

    return NextResponse.json(
      context,
      { status: context.allowed ? 200 : 403 }
    );
  } catch (error: any) {
    console.error('Error resolving workspace context:', error);
    return NextResponse.json(
      {
        allowed: false,
        error: 'INTERNAL_ERROR',
        message: 'Internal server error'
      },
      { status: 500 }
    );
  }
}
