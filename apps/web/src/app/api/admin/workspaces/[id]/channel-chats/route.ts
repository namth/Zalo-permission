export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { prisma, runCypher } from '@omniagent/database';
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

    const workspaceId = params.id;
    const { searchParams } = new URL(req.url);
    const available = searchParams.get('available') === 'true';

    if (available) {
      // Return all chats across all accounts to allow user to pick and assign
      const allChats = await prisma.channelChat.findMany({
        include: {
          account: {
            select: { id: true, accountName: true, platform: true, metadata: true },
          },
          workspace: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const data = allChats.map((c: any) => ({
        id: c.id,
        account_id: c.accountId,
        account_name: c.account?.accountName || 'Unknown',
        platform: c.platform,
        platform_chat_id: c.platformChatId,
        title: c.title,
        chat_type: c.chatType,
        is_active: c.isActive,
        always_respond: Boolean(c.alwaysRespond),
        workspace_id: c.workspaceId,
        workspace_name: c.workspace?.name || null,
        is_assigned_to_current: c.workspaceId === workspaceId,
        created_at: c.createdAt,
      }));

      return NextResponse.json({ success: true, data });
    }

    // Return chats assigned to this workspace
    const chats = await prisma.channelChat.findMany({
      where: { workspaceId },
      include: {
        account: {
          select: { id: true, accountName: true, platform: true, metadata: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = chats.map((c: any) => ({
      id: c.id,
      account_id: c.accountId,
      account_name: c.account?.accountName || 'Unknown',
      platform: c.platform,
      platform_chat_id: c.platformChatId,
      title: c.title,
      chat_type: c.chatType,
      is_active: c.isActive,
      always_respond: Boolean(c.alwaysRespond),
      created_at: c.createdAt,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[API /api/admin/workspaces/:id/channel-chats GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch workspace channel chats' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = params.id;
    const body = await req.json();
    const { chat_id, account_id, chats } = body;

    // Check workspace
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!ws) {
      return NextResponse.json(
        { success: false, error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Trường hợp 1: Batch thêm các nhóm mới quét được từ một kênh
    if (account_id && Array.isArray(chats) && chats.length > 0) {
      const account = await prisma.channelAccount.findUnique({
        where: { id: account_id },
      });
      if (!account) {
        return NextResponse.json(
          { success: false, error: 'Tài khoản kênh không tồn tại' },
          { status: 404 }
        );
      }

      const createdChats = [];
      for (const item of chats) {
        if (!item.platform_chat_id || !item.title) continue;

        const existingChat = await prisma.channelChat.findFirst({
          where: {
            platform: account.platform,
            platformChatId: String(item.platform_chat_id).trim(),
          },
        });

        let chat;
        if (existingChat) {
          chat = await prisma.channelChat.update({
            where: { id: existingChat.id },
            data: {
              accountId: account.id,
              title: String(item.title).trim(),
              workspaceId,
              isActive: true,
            },
          });
        } else {
          chat = await prisma.channelChat.create({
            data: {
              accountId: account.id,
              platform: account.platform,
              platformChatId: String(item.platform_chat_id).trim(),
              title: String(item.title).trim(),
              chatType: item.chat_type || 'GROUP',
              workspaceId,
              isActive: true,
            },
          });
        }

        // Sync Neo4j
        const cypher = `
          MERGE (c:ChannelChat { id: $id })
          SET c.platform = $platform,
              c.platform_chat_id = $platform_chat_id,
              c.title = $title
          WITH c
          OPTIONAL MATCH (c)-[r:BELONGS_TO]->(:Workspace)
          DELETE r
          WITH c
          MATCH (w:Workspace { id: $workspace_id })
          MERGE (c)-[:BELONGS_TO]->(w)
          RETURN c.id AS id
        `;
        await runCypher(cypher, {
          id: chat.id,
          platform: account.platform,
          platform_chat_id: String(item.platform_chat_id).trim(),
          title: String(item.title).trim(),
          workspace_id: workspaceId,
        }).catch((e) => console.warn('[Neo4j batch sync warning]:', e));

        createdChats.push(chat);
      }

      return NextResponse.json({
        success: true,
        message: `Đã thêm thành công ${createdChats.length} nhóm chat vào Workspace`,
        data: createdChats,
      });
    }

    // Trường hợp 2: Gán một nhóm chat đã có sẵn ID vào Workspace
    if (!chat_id) {
      return NextResponse.json(
        { success: false, error: 'chat_id hoặc (account_id và danh sách chats) là bắt buộc' },
        { status: 400 }
      );
    }

    // Assign chat to workspace in Postgres
    const updated = await prisma.channelChat.update({
      where: { id: chat_id },
      data: { workspaceId },
      include: {
        account: { select: { id: true, accountName: true, platform: true } },
        workspace: { select: { id: true, name: true } },
      },
    });

    // Sync to Neo4j
    const cypher = `
      MATCH (c:ChannelChat { id: $id })
      OPTIONAL MATCH (c)-[r:BELONGS_TO]->(:Workspace)
      DELETE r
      WITH c
      MATCH (w:Workspace { id: $workspace_id })
      MERGE (c)-[:BELONGS_TO]->(w)
      RETURN c.id AS id
    `;
    await runCypher(cypher, {
      id: chat_id,
      workspace_id: workspaceId,
    }).catch((e) => console.warn('[Neo4j workspace channel-chat sync warning]:', e));

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        platform: updated.platform,
        platform_chat_id: updated.platformChatId,
        title: updated.title,
        chat_type: updated.chatType,
        is_active: updated.isActive,
        always_respond: Boolean(updated.alwaysRespond),
        account_name: updated.account?.accountName,
        workspace_id: updated.workspaceId,
        workspace_name: updated.workspace?.name,
      },
    });
  } catch (error) {
    console.error('[API /api/admin/workspaces/:id/channel-chats POST] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to assign channel chat to workspace' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = params.id;
    const body = await req.json();
    const { chat_id, always_respond, is_active } = body;

    if (!chat_id) {
      return NextResponse.json({ success: false, error: 'chat_id is required' }, { status: 400 });
    }

    const chat = await prisma.channelChat.findFirst({
      where: { id: chat_id, workspaceId },
    });

    if (!chat) {
      return NextResponse.json(
        { success: false, error: 'Chat not found in this workspace' },
        { status: 404 }
      );
    }

    const updated = await prisma.channelChat.update({
      where: { id: chat_id },
      data: {
        alwaysRespond: always_respond !== undefined ? Boolean(always_respond) : undefined,
        isActive: is_active !== undefined ? Boolean(is_active) : undefined,
      },
      include: {
        account: { select: { accountName: true } },
      },
    });

    // Sync to Neo4j
    if (always_respond !== undefined) {
      await runCypher(
        `MATCH (c:ChannelChat { id: $id }) SET c.always_respond = $always_respond RETURN c.id`,
        { id: chat_id, always_respond: updated.alwaysRespond }
      ).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      message: 'Cập nhật cấu hình nhóm chat thành công',
      data: {
        id: updated.id,
        platform: updated.platform,
        platform_chat_id: updated.platformChatId,
        title: updated.title,
        chat_type: updated.chatType,
        is_active: updated.isActive,
        always_respond: Boolean(updated.alwaysRespond),
        account_name: updated.account?.accountName,
      },
    });
  } catch (error) {
    console.error('[API /api/admin/workspaces/:id/channel-chats PATCH] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update channel chat setting' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = params.id;
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chat_id');

    if (!chatId) {
      return NextResponse.json(
        { success: false, error: 'chat_id is required' },
        { status: 400 }
      );
    }

    // Unassign in Postgres
    await prisma.channelChat.updateMany({
      where: { id: chatId, workspaceId },
      data: { workspaceId: null },
    });

    // Remove relationship in Neo4j
    const cypher = `
      MATCH (c:ChannelChat { id: $id })-[r:BELONGS_TO]->(w:Workspace { id: $workspace_id })
      DELETE r
    `;
    await runCypher(cypher, {
      id: chatId,
      workspace_id: workspaceId,
    }).catch((e) => console.warn('[Neo4j unassign warning]:', e));

    return NextResponse.json({
      success: true,
      message: 'Channel chat unassigned from workspace successfully',
    });
  } catch (error) {
    console.error('[API /api/admin/workspaces/:id/channel-chats DELETE] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to unassign channel chat from workspace' },
      { status: 500 }
    );
  }
}
