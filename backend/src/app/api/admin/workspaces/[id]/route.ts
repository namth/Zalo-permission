import { NextRequest, NextResponse } from 'next/server';
import { getWorkspace, updateWorkspace, deleteWorkspace } from '@/services/workspace.service';

/**
 * GET /api/admin/workspaces/:id - Get workspace detail
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workspace = await getWorkspace(params.id);

    if (!workspace) {
      return NextResponse.json(
        { success: false, error: 'Workspace not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: workspace }, { status: 200 });
  } catch (error: any) {
    console.error('Error getting workspace:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get workspace' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/workspaces/:id - Update workspace
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const workspace = await updateWorkspace(
      params.id,
      {
        name: body.name,
        status: body.status,
        description: body.description
      },
      body.updated_by
    );

    return NextResponse.json({ success: true, data: workspace }, { status: 200 });
  } catch (error: any) {
    console.error('Error updating workspace:', error);

    if (error.message.includes('not found')) {
      return NextResponse.json(
        { success: false, error: 'Workspace not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update workspace' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/workspaces/:id - Delete workspace
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json().catch(() => ({}));

    await deleteWorkspace(params.id, body.deleted_by);

    return NextResponse.json(
      { success: true, message: 'Workspace deleted' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting workspace:', error);

    if (error.message.includes('not found')) {
      return NextResponse.json(
        { success: false, error: 'Workspace not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete workspace' },
      { status: 500 }
    );
  }
}
