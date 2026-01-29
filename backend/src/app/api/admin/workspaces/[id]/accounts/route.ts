import { NextRequest, NextResponse } from 'next/server';
import { listWorkspaceAccounts, createAccount } from '@/services/account.service';

/**
 * GET /api/admin/workspaces/:id/accounts - List workspace accounts
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = request.nextUrl;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const { accounts, total } = await listWorkspaceAccounts(params.id, limit, offset);

    return NextResponse.json(
      {
        success: true,
        data: accounts,
        pagination: { limit, offset, total, hasMore: offset + limit < total }
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error getting workspace accounts:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get workspace accounts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/workspaces/:id/accounts - Create account in workspace
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    if (!body.type) {
      return NextResponse.json(
        { success: false, error: 'Missing type' },
        { status: 400 }
      );
    }

    const account = await createAccount(
      params.id,
      body.type,
      body.reference_id,
      body.metadata,
      body.created_by
    );

    return NextResponse.json({ success: true, data: account }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating account:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create account' },
      { status: 500 }
    );
  }
}
