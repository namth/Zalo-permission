import { NextRequest, NextResponse } from 'next/server';
import { getAccount, updateAccount, deleteAccount } from '@/services/account.service';

/**
 * GET /api/admin/workspaces/:id/accounts/:account_id - Get account detail
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; account_id: string } }
) {
  try {
    const account = await getAccount(params.account_id);

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      );
    }

    // Verify account belongs to workspace
    if (account.workspace_id !== params.id) {
      return NextResponse.json(
        { success: false, error: 'Account not found in this workspace' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: account }, { status: 200 });
  } catch (error: any) {
    console.error('Error getting account:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get account' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/workspaces/:id/accounts/:account_id - Update account
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; account_id: string } }
) {
  try {
    const body = await request.json();

    // Verify account exists and belongs to workspace
    const account = await getAccount(params.account_id);
    if (!account || account.workspace_id !== params.id) {
      return NextResponse.json(
        { success: false, error: 'Account not found in this workspace' },
        { status: 404 }
      );
    }

    const updated = await updateAccount(
      params.account_id,
      {
        type: body.type,
        reference_id: body.reference_id,
        metadata: body.metadata
      },
      body.updated_by
    );

    return NextResponse.json({ success: true, data: updated }, { status: 200 });
  } catch (error: any) {
    console.error('Error updating account:', error);

    if (error.message.includes('not found')) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update account' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/workspaces/:id/accounts/:account_id - Delete account
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; account_id: string } }
) {
  try {
    const body = await request.json().catch(() => ({}));

    // Verify account exists and belongs to workspace
    const account = await getAccount(params.account_id);
    if (!account || account.workspace_id !== params.id) {
      return NextResponse.json(
        { success: false, error: 'Account not found in this workspace' },
        { status: 404 }
      );
    }

    await deleteAccount(params.account_id, body.deleted_by);

    return NextResponse.json(
      { success: true, message: 'Account deleted' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting account:', error);

    if (error.message.includes('not found')) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete account' },
      { status: 500 }
    );
  }
}
