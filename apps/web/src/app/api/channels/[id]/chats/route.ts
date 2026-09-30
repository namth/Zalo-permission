export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { prisma, runCypher } from '@omniagent/database';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const accountId = params.id;
    const chats = await prisma.channelChat.findMany({
      where: { accountId },
      include: {
        workspace: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = chats.map((c: any) => ({
      id: c.id,
      platform: c.platform,
      platform_chat_id: c.platformChatId,
      title: c.title,
      chat_type: c.chatType,
      is_active: c.isActive,
      always_respond: Boolean(c.alwaysRespond),
      workspace_id: c.workspaceId,
      workspace_name: c.workspace?.name || null,
      created_at: c.createdAt,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[API /api/channels/:id/chats] Error fetching chats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch chats' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const accountId = params.id;
    const body = await req.json();
    const { platform_chat_id, title, chat_type = 'GROUP', workspace_id } = body;

    if (!platform_chat_id || !title) {
      return NextResponse.json(
        { success: false, error: 'platform_chat_id and title are required' },
        { status: 400 }
      );
    }

    const account = await prisma.channelAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Channel account not found' },
        { status: 404 }
      );
    }

    // Upsert chat in PostgreSQL
    const chat = await prisma.channelChat.upsert({
      where: {
        platform_platformChatId: {
          platform: account.platform,
          platformChatId: String(platform_chat_id).trim(),
        },
      },
      update: {
        title: title.trim(),
        workspaceId: workspace_id ? String(workspace_id) : null,
        chatType: chat_type,
        isActive: true,
      },
      create: {
        accountId,
        platform: account.platform,
        platformChatId: String(platform_chat_id).trim(),
        title: title.trim(),
        chatType: chat_type,
        workspaceId: workspace_id ? String(workspace_id) : null,
        isActive: true,
      },
      include: {
        workspace: { select: { id: true, name: true } },
      },
    });

    // Sync to Neo4j graph
    const cypher = `
      MERGE (c:ChannelChat { id: $id })
      SET c.platform = $platform,
          c.platform_chat_id = $platform_chat_id,
          c.title = $title
      WITH c
      OPTIONAL MATCH (c)-[r:BELONGS_TO]->(:Workspace)
      DELETE r
      WITH c
      ${
        workspace_id
          ? `
        MATCH (w:Workspace { id: $workspace_id })
        MERGE (c)-[:BELONGS_TO]->(w)
      `
          : ''
      }
      RETURN c.id AS id
    `;

    await runCypher(cypher, {
      id: chat.id,
      platform: account.platform,
      platform_chat_id: String(platform_chat_id).trim(),
      title: title.trim(),
      workspace_id: workspace_id || null,
    }).catch((e) => console.warn('[Neo4j sync warning]:', e));

    return NextResponse.json({
      success: true,
      data: {
        id: chat.id,
        platform: chat.platform,
        platform_chat_id: chat.platformChatId,
        title: chat.title,
        chat_type: chat.chatType,
        is_active: chat.isActive,
        workspace_id: chat.workspaceId,
        workspace_name: chat.workspace?.name || null,
        created_at: chat.createdAt,
      },
    });
  } catch (error) {
    console.error('[API /api/channels/:id/chats] Error creating chat:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save chat' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const accountId = params.id;
    const body = await req.json();
    const { chat_id, workspace_id, title, is_active, always_respond } = body;

    if (!chat_id) {
      return NextResponse.json(
        { success: false, error: 'chat_id is required' },
        { status: 400 }
      );
    }

    const existing = await prisma.channelChat.findFirst({
      where: { id: chat_id, accountId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Chat not found for this account' },
        { status: 404 }
      );
    }

    // Update in Postgres
    const updated = await prisma.channelChat.update({
      where: { id: chat_id },
      data: {
        workspaceId: workspace_id !== undefined ? (workspace_id || null) : undefined,
        title: title !== undefined ? String(title).trim() : undefined,
        isActive: is_active !== undefined ? Boolean(is_active) : undefined,
        alwaysRespond: always_respond !== undefined ? Boolean(always_respond) : undefined,
      },
      include: {
        workspace: { select: { id: true, name: true } },
      },
    });

    // Update in Neo4j
    const targetWsId = workspace_id !== undefined ? (workspace_id || null) : updated.workspaceId;
    const cypher = `
      MATCH (c:ChannelChat { id: $id })
      OPTIONAL MATCH (c)-[r:BELONGS_TO]->(:Workspace)
      DELETE r
      WITH c
      ${
        targetWsId
          ? `
        MATCH (w:Workspace { id: $workspace_id })
        MERGE (c)-[:BELONGS_TO]->(w)
      `
          : ''
      }
      ${always_respond !== undefined ? 'SET c.always_respond = $always_respond' : ''}
      RETURN c.id AS id
    `;

    await runCypher(cypher, {
      id: chat_id,
      workspace_id: targetWsId,
      always_respond: updated.alwaysRespond,
    }).catch((e) => console.warn('[Neo4j update warning]:', e));

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
        workspace_id: updated.workspaceId,
        workspace_name: updated.workspace?.name || null,
        created_at: updated.createdAt,
      },
    });
  } catch (error) {
    console.error('[API /api/channels/:id/chats PATCH] Error updating chat:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update chat' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const accountId = params.id;
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chat_id');

    if (!chatId) {
      return NextResponse.json(
        { success: false, error: 'chat_id query parameter is required' },
        { status: 400 }
      );
    }

    const existing = await prisma.channelChat.findFirst({
      where: { id: chatId, accountId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Chat not found for this account' },
        { status: 404 }
      );
    }

    // Delete in Postgres
    await prisma.channelChat.delete({
      where: { id: chatId },
    });

    // Delete in Neo4j
    await runCypher(`MATCH (c:ChannelChat { id: $id }) DETACH DELETE c`, {
      id: chatId,
    }).catch((e) => console.warn('[Neo4j delete warning]:', e));

    return NextResponse.json({ success: true, message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('[API /api/channels/:id/chats DELETE] Error deleting chat:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete chat' },
      { status: 500 }
    );
  }
}
