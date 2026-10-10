export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { query, ensureWorkspacesSchema } from '@/lib/db';

export async function GET(): Promise<NextResponse> {
  try {
    await ensureWorkspacesSchema().catch((schemaErr) => {
      console.warn('[API /api/channels] ensureWorkspacesSchema warning:', schemaErr?.message);
    });

    const res = await query(`
      SELECT 
        ca.id, 
        ca.platform, 
        COALESCE(ca.account_name, 'Tài khoản') as account_name,
        COALESCE(ca.auth_type, 'QR_SESSION') as auth_type,
        ca.status, 
        ca.metadata, 
        ca.last_synced_at, 
        ca.created_at,
        (SELECT COUNT(*)::int FROM channel_chats cc WHERE cc.account_id = ca.id) as chat_count
      FROM channel_accounts ca
      ORDER BY ca.created_at DESC
    `);

    const data = res.rows.map((acc: any) => {
      let meta = acc.metadata;
      if (typeof meta === 'string') {
        try {
          meta = JSON.parse(meta);
        } catch (_) {
          meta = {};
        }
      }
      return {
        id: acc.id,
        platform: acc.platform,
        account_name: acc.account_name || 'Tài khoản',
        auth_type: acc.auth_type || 'QR_SESSION',
        status: acc.status || 'ACTIVE',
        metadata: meta || {},
        chat_count: Number(acc.chat_count || 0),
        last_synced_at: acc.last_synced_at || null,
        created_at: acc.created_at || new Date().toISOString(),
      };
    });

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
