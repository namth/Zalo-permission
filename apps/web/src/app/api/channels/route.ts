import { NextResponse } from 'next/server';
import { prisma } from '@omniagent/database';

export async function GET(): Promise<NextResponse> {
  try {
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
      chat_count: acc._count.channelChats,
      last_synced_at: acc.lastSyncedAt,
      created_at: acc.createdAt,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[API /api/channels] Error fetching channel accounts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch channel accounts' },
      { status: 500 }
    );
  }
}
