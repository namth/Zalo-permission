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

    let accounts: any[] = [];
    try {
      accounts = await prisma.channelAccount.findMany({
        include: {
          _count: {
            select: { channelChats: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (countErr: any) {
      console.warn('[API /api/channels] Count query failed, falling back to simple findMany:', countErr?.message);
      try {
        accounts = await prisma.channelAccount.findMany({
          orderBy: { createdAt: 'desc' },
        });
      } catch (findErr: any) {
        console.warn('[API /api/channels] Prisma findMany failed, falling back to raw SQL:', findErr?.message);
        const rawRows: any = await prisma.$queryRawUnsafe(`
          SELECT id, platform, 
                 COALESCE("accountName", account_name, 'Tài khoản') as "accountName",
                 COALESCE("authType", auth_type, 'QR_SESSION') as "authType", 
                 status, metadata,
                 COALESCE("lastSyncedAt", last_synced_at) as "lastSyncedAt",
                 COALESCE("createdAt", created_at, NOW()) as "createdAt"
          FROM channel_accounts
          ORDER BY created_at DESC
        `);
        accounts = rawRows;
      }
    }

    const data = accounts.map((acc: any) => ({
      id: acc.id,
      platform: acc.platform,
      account_name: acc.accountName || acc.account_name || 'Tài khoản',
      auth_type: acc.authType || acc.auth_type || 'QR_SESSION',
      status: acc.status || 'ACTIVE',
      metadata: acc.metadata || {},
      chat_count: acc._count?.channelChats || 0,
      last_synced_at: acc.lastSyncedAt || acc.last_synced_at || null,
      created_at: acc.createdAt || acc.created_at || new Date().toISOString(),
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
