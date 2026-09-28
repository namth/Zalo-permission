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
      chat_count: acc._count?.channelChats || 0,
      last_synced_at: acc.lastSyncedAt,
      created_at: acc.createdAt,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('[API /api/channels] Error fetching channel accounts:', error);
    // If the table doesn't exist yet, return empty list gracefully rather than 500 error
    return NextResponse.json({ success: true, data: [] });
  }
}
