import { NextRequest, NextResponse } from 'next/server';
import {
  createWorkspace,
  listWorkspaces,
  updateWorkspace,
  deleteWorkspace
} from '@/services/workspace.service';

/**
 * POST /api/admin/workspaces - Create workspace
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { success: false, error: 'Missing name' },
        { status: 400 }
      );
    }

    const workspace = await createWorkspace(
      body.name,
      body.description,
      body.created_by
    );

    return NextResponse.json(
      { success: true, data: workspace },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating workspace:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create workspace' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/workspaces - List workspaces
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const { workspaces, total } = await listWorkspaces(limit, offset);

    return NextResponse.json(
      {
        success: true,
        data: workspaces,
        pagination: { limit, offset, total, hasMore: offset + limit < total }
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error listing workspaces:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list workspaces' },
      { status: 500 }
    );
  }
}
