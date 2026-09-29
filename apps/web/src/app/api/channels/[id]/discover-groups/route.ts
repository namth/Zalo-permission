export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@omniagent/database';
import { discoverZaloGroups, type DiscoveredZaloGroup } from '@omniagent/channels';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const accountId = params.id;
    const account = await prisma.channelAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Tài khoản kênh không tồn tại' },
        { status: 404 }
      );
    }

    // Lấy danh sách ID các nhóm chat đã có trong hệ thống (để lọc bỏ)
    const existingChats = await prisma.channelChat.findMany({
      where: {
        platform: account.platform,
      },
      select: {
        platformChatId: true,
      },
    });

    const existingChatIds = new Set(existingChats.map((c) => c.platformChatId));

    if (account.platform === 'ZALO') {
      try {
        const discovered: DiscoveredZaloGroup[] = await discoverZaloGroups(account.encryptedCredentials);
        
        // Lọc bỏ toàn bộ các nhóm đã có trong hệ thống
        const newGroups = discovered
          .filter((g: DiscoveredZaloGroup) => !existingChatIds.has(g.groupId))
          .map((g: DiscoveredZaloGroup) => ({
            id: g.groupId,
            title: g.name,
            avatar: g.avatar || null,
            members_count: g.totalMember || 0,
            platform: 'ZALO' as const,
          }));

        return NextResponse.json({
          success: true,
          platform: 'ZALO',
          account_name: account.accountName,
          total_discovered: discovered.length,
          data: newGroups,
        });
      } catch (scanErr: any) {
        console.error('[discover-groups Zalo error]:', scanErr);
        return NextResponse.json(
          {
            success: false,
            error: scanErr.message || 'Không thể quét danh sách nhóm từ tài khoản Zalo này',
          },
          { status: 500 }
        );
      }
    } else if (account.platform === 'TELEGRAM') {
      // Với Telegram: Lấy các nhóm đã phát hiện nhưng chưa được gán Workspace nào
      const unassignedTelegramChats = await prisma.channelChat.findMany({
        where: {
          accountId: account.id,
          workspaceId: null,
        },
        orderBy: { createdAt: 'desc' },
      });

      const data = unassignedTelegramChats.map((c) => ({
        id: c.platformChatId,
        title: c.title,
        avatar: null,
        members_count: 0,
        platform: 'TELEGRAM' as const,
      }));

      return NextResponse.json({
        success: true,
        platform: 'TELEGRAM',
        account_name: account.accountName,
        total_discovered: data.length,
        data,
      });
    }

    return NextResponse.json({ success: true, data: [] });
  } catch (error: any) {
    console.error('[API /api/channels/:id/discover-groups] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi khi quét nhóm chat: ' + error.message },
      { status: 500 }
    );
  }
}
