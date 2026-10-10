export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { runCypher } from '@omniagent/database';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const accountId = params.id;
    const chatsRes = await query(`
      SELECT 
        cc.id,
        cc.platform,
        cc.platform_chat_id,
        cc.title,
        cc.chat_type,
        cc.is_active,
        cc.always_respond,
        cc.workspace_id,
        w.name as workspace_name,
        cc.created_at
      FROM channel_chats cc
      LEFT JOIN workspaces w ON w.id = cc.workspace_id
      WHERE cc.account_id = $1
      ORDER BY cc.created_at DESC
    `, [accountId]);

    const data = chatsRes.rows.map((c: any) => ({
      id: c.id,
      platform: c.platform,
      platform_chat_id: c.platform_chat_id,
      title: c.title,
      chat_type: c.chat_type,
      is_active: Boolean(c.is_active),
      always_respond: Boolean(c.always_respond),
      workspace_id: c.workspace_id,
      workspace_name: c.workspace_name || null,
      created_at: c.created_at,
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

    const accRes = await query(`SELECT id, platform FROM channel_accounts WHERE id = $1`, [accountId]);
    if (accRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Channel account not found' },
        { status: 404 }
      );
    }
    const account = accRes.rows[0];

    // Upsert chat in PostgreSQL
    const chatRes = await query(`
      INSERT INTO channel_chats (id, account_id, platform, platform_chat_id, title, chat_type, workspace_id, is_active, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, true, NOW(), NOW())
      ON CONFLICT (platform, platform_chat_id) DO UPDATE
      SET title = EXCLUDED.title,
          workspace_id = EXCLUDED.workspace_id,
          chat_type = EXCLUDED.chat_type,
          is_active = true,
          updated_at = NOW()
      RETURNING *
    `, [accountId, account.platform, String(platform_chat_id).trim(), title.trim(), chat_type, workspace_id ? String(workspace_id) : null]);
    const chat = chatRes.rows[0];

    let wsName = null;
    if (chat.workspace_id) {
      const wsRes = await query(`SELECT name FROM workspaces WHERE id = $1`, [chat.workspace_id]);
      wsName = wsRes.rows[0]?.name || null;
    }

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
        platform_chat_id: chat.platform_chat_id,
        title: chat.title,
        chat_type: chat.chat_type,
        is_active: chat.is_active,
        workspace_id: chat.workspace_id,
        workspace_name: wsName,
        created_at: chat.created_at,
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

    const existingRes = await query(`SELECT * FROM channel_chats WHERE id = $1 AND account_id = $2`, [chat_id, accountId]);
    if (existingRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Chat not found for this account' },
        { status: 404 }
      );
    }
    const oldChat = existingRes.rows[0];

    const targetWsId = workspace_id !== undefined ? (workspace_id || null) : oldChat.workspace_id;
    const targetTitle = title !== undefined ? String(title).trim() : oldChat.title;
    const targetIsActive = is_active !== undefined ? Boolean(is_active) : oldChat.is_active;
    const targetAlwaysRespond = always_respond !== undefined ? Boolean(always_respond) : Boolean(oldChat.always_respond);

    // Update in Postgres
    const updatedRes = await query(`
      UPDATE channel_chats
      SET workspace_id = $1, title = $2, is_active = $3, always_respond = $4, updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `, [targetWsId, targetTitle, targetIsActive, targetAlwaysRespond, chat_id]);
    const updated = updatedRes.rows[0];

    let wsName = null;
    if (updated.workspace_id) {
      const wsRes = await query(`SELECT name FROM workspaces WHERE id = $1`, [updated.workspace_id]);
      wsName = wsRes.rows[0]?.name || null;
    }

    // Update in Neo4j
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
      always_respond: updated.always_respond,
    }).catch((e) => console.warn('[Neo4j update warning]:', e));

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        platform: updated.platform,
        platform_chat_id: updated.platform_chat_id,
        title: updated.title,
        chat_type: updated.chat_type,
        is_active: updated.is_active,
        always_respond: Boolean(updated.always_respond),
        workspace_id: updated.workspace_id,
        workspace_name: wsName,
        created_at: updated.created_at,
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

    const existingRes = await query(`SELECT * FROM channel_chats WHERE id = $1 AND account_id = $2`, [chatId, accountId]);
    if (existingRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Chat not found for this account' },
        { status: 404 }
      );
    }

    // Delete in Postgres
    await query(`DELETE FROM channel_chats WHERE id = $1`, [chatId]);

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
