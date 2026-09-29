import { NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres';
import { DEFAULT_AGENT_PERSONA } from '@omniagent/core';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Fetch channel accounts & chats
    const channelsRes = await query(`
      SELECT 
        ca.id, ca.platform, ca.account_name, ca.status,
        COUNT(cc.id) as chat_count
      FROM channel_accounts ca
      LEFT JOIN channel_chats cc ON cc.account_id = ca.id
      GROUP BY ca.id, ca.platform, ca.account_name, ca.status
    `).catch(() => ({ rows: [] }));

    // 2. Fetch workspaces count & tool count
    const workspacesRes = await query(`
      SELECT 
        w.id, w.name, w.is_active,
        (SELECT COUNT(*) FROM channel_chats cc WHERE cc.workspace_id = w.id) as linked_chats,
        (SELECT COUNT(*) FROM workspace_tool_configs wtc WHERE wtc.workspace_id = w.id AND wtc.is_enabled = true) as linked_tool_groups
      FROM workspaces w
      WHERE w.is_active = true
      LIMIT 10
    `).catch(() => ({ rows: [] }));

    // 3. Fetch tool groups & tools count
    const toolsCountRes = await query(`
      SELECT 
        (SELECT COUNT(*) FROM tool_groups WHERE is_active = true) as total_tool_groups,
        (SELECT COUNT(*) FROM tools WHERE is_active = true) as total_tools
    `).catch(() => ({ rows: [{ total_tool_groups: 0, total_tools: 0 }] }));

    // 4. Fetch recent 6 audit logs
    const recentLogsRes = await query(`
      SELECT 
        id, platform, sender_id, user_prompt, detected_intent,
        matched_skill_id, execution_plan, tool_calls, final_response,
        status, latency_ms, created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 6
    `).catch(() => ({ rows: [] }));

    return NextResponse.json({
      success: true,
      data: {
        channels: channelsRes.rows,
        workspaces: workspacesRes.rows,
        metrics: {
          totalToolGroups: Number(toolsCountRes.rows[0]?.total_tool_groups || 0),
          totalTools: Number(toolsCountRes.rows[0]?.total_tools || 0),
          activeChannels: channelsRes.rows.filter((c: any) => c.status === 'ACTIVE').length,
          totalWorkspaces: workspacesRes.rows.length,
        },
        agent: {
          name: 'Thảo Chi',
          company: 'Công Ty Công Nghệ INOVA',
          routerModel: process.env.ROUTER_MODEL_ID || 'google/gemini-2.0-flash',
          workerModel: process.env.WORKER_MODEL_ID || 'openai/gpt-4o-mini',
          synthesizerModel: process.env.SYNTHESIZER_MODEL_ID || 'deepseek/deepseek-chat',
          inboundStream: 'stream:inbound_messages',
          outboundStream: 'stream:outbound_messages',
          personaSummary: DEFAULT_AGENT_PERSONA,
        },
        recentLogs: recentLogsRes.rows,
      },
    });
  } catch (err: any) {
    console.error('[Workflow API] Error fetching stats:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
