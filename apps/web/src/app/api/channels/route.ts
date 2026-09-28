export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@omniagent/database';
import { ensureWorkspacesSchema } from '@/lib/db';

export async function GET(): Promise<NextResponse> {
  try {
    await ensureWorkspacesSchema().catch((schemaErr) => {
      console.warn('[API /api/channels] ensureWorkspacesSchema warning:', schemaErr?.message);
    });

    const accounts = await prisma.channelAccount.findMany({
      include: {
        _count: {
          select: { channelChats: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = accounts.map((acc: any) => ({
      id: acc.id,
      platform: acc.platform,
      account_name: acc.accountName,
      auth_type: acc.authType,
      status: acc.status,
      metadata: acc.metadata || {},
      chat_count: acc._count?.channelChats || 0,
      last_synced_at: acc.lastSyncedAt,
      created_at: acc.createdAt,
    }));

    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error: any) {
    console.error('[API /api/channels] Error fetching channel accounts:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch channel accounts' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
