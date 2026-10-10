export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { prisma, runCypher } from '@omniagent/database';
import { getCurrentUser } from '@/lib/auth';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; accountId: string } }
): Promise<NextResponse> {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: workspaceId, accountId } = params;

    const rootPlatformChatId = `DIRECT_ROOT:${accountId}`;

    // Tìm bản ghi DIRECT_ROOT trong PostgreSQL
    const existingRoot = await prisma.channelChat.findFirst({
      where: {
        accountId,
        platformChatId: rootPlatformChatId,
        workspaceId,
      },
    });

    if (existingRoot) {
      await prisma.channelChat.update({
        where: { id: existingRoot.id },
        data: {
          workspaceId: null,
          isActive: false,
        },
      });
    }

    // Xóa quan hệ trên Neo4j
    const cypher = `
      MATCH (acc:ChannelAccount { id: $account_id })-[r:DIRECT_ROUTED_TO]->(w:Workspace { id: $workspace_id })
      DELETE r
    `;
    await runCypher(cypher, {
      account_id: accountId,
      workspace_id: workspaceId,
    }).catch((err) => console.warn('[API direct-chats DELETE] Neo4j notice:', err));

    return NextResponse.json({
      success: true,
      message: 'Đã hủy gán trợ lý chat cá nhân khỏi Workspace',
    });
  } catch (error) {
    console.error('[API direct-chats DELETE] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi hủy gán trợ lý chat cá nhân' },
      { status: 500 }
    );
  }
}
