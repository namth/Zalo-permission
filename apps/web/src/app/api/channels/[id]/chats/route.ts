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
          platformChatId: String(platform_chat_id),
        },
      },
      update: {
        title,
        workspaceId: workspace_id || undefined,
        isActive: true,
      },
      create: {
        accountId,
        platform: account.platform,
        platformChatId: String(platform_chat_id),
        title,
        chatType: chat_type,
        workspaceId: workspace_id || null,
        isActive: true,
      },
    });

    // Sync to Neo4j graph
    const cypher = `
      MERGE (c:ChannelChat { id: $id })
      SET c.platform = $platform,
          c.platform_chat_id = $platform_chat_id,
          c.title = $title
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
      platform_chat_id: String(platform_chat_id),
      title,
      workspace_id: workspace_id || null,
    }).catch((e) => console.warn('[Neo4j sync warning]:', e));

    return NextResponse.json({ success: true, data: chat });
  } catch (error) {
    console.error('[API /api/channels/:id/chats] Error creating chat:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save chat' },
      { status: 500 }
    );
  }
}
