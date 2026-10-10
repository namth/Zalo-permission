export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { prisma, runCypher } from '@omniagent/database';
import { getCurrentUser } from '@/lib/auth';

function checkIsInShift(workingTime: any): boolean {
  if (!workingTime || typeof workingTime !== 'object') return false;
  const { workingDays, startTime, endTime, timezone } = workingTime;
  if (!startTime || !endTime) return false;

  const tz = timezone || 'Asia/Ho_Chi_Minh';
  const now = new Date();

  if (Array.isArray(workingDays) && workingDays.length > 0) {
    const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' });
    const dayStr = dayFormatter.format(now);
    const dayMap: Record<string, number> = {
      Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
    };
    const currentDay = dayMap[dayStr] || 1;
    if (!workingDays.includes(currentDay)) return false;
  }

  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const currentTime = timeFormatter.format(now);
  return currentTime >= startTime && currentTime <= endTime;
}

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

    // 1. Lấy tất cả các tài khoản kênh
    const accounts = await prisma.channelAccount.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // 2. Lấy tất cả các bản ghi DIRECT_ROOT
    const directRoots = await prisma.channelChat.findMany({
      where: {
        chatType: 'DIRECT',
        platformChatId: { startsWith: 'DIRECT_ROOT:' },
      },
      include: {
        workspace: {
          select: { id: true, name: true },
        },
      },
    });

    const directRootMap = new Map<string, any>();
    for (const r of directRoots) {
      directRootMap.set(r.accountId, r);
    }

    const data = accounts.map((acc: any) => {
      const root = directRootMap.get(acc.id);
      const isAssigned = Boolean(root?.workspaceId);
      const isAssignedToCurrent = root?.workspaceId === workspaceId;
      const workingTime = root?.workingTime || null;

      return {
        account_id: acc.id,
        platform: acc.platform,
        account_name: acc.accountName,
        status: acc.status,
        is_assigned: isAssigned,
        is_assigned_to_current: isAssignedToCurrent,
        assigned_workspace: root?.workspace
          ? { id: root.workspace.id, name: root.workspace.name }
          : null,
        working_time: workingTime,
        is_in_shift: isAssigned && checkIsInShift(workingTime),
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[API direct-chats GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch direct chats' },
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
    const { account_id, working_days, start_time, end_time, timezone, takeover_minutes } = body;

    if (!account_id) {
      return NextResponse.json(
        { success: false, error: 'account_id là bắt buộc' },
        { status: 400 }
      );
    }

    // Kiểm tra Workspace
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!ws) {
      return NextResponse.json(
        { success: false, error: 'Workspace không tồn tại' },
        { status: 404 }
      );
    }

    // Kiểm tra ChannelAccount
    const account = await prisma.channelAccount.findUnique({
      where: { id: account_id },
    });
    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Tài khoản kênh không tồn tại' },
        { status: 404 }
      );
    }

    const workingTime = {
      workingDays: Array.isArray(working_days) ? working_days : [1, 2, 3, 4, 5],
      startTime: start_time || '08:00',
      endTime: end_time || '18:00',
      timezone: timezone || 'Asia/Ho_Chi_Minh',
      takeoverMinutes: typeof takeover_minutes === 'number' ? takeover_minutes : 30,
    };

    const rootPlatformChatId = `DIRECT_ROOT:${account.id}`;

    // Tìm hoặc tạo bản ghi DIRECT_ROOT trong PostgreSQL (Atomic Upsert)
    const existingRoot = await prisma.channelChat.findUnique({
      where: {
        platform_platformChatId: {
          platform: account.platform,
          platformChatId: rootPlatformChatId,
        },
      },
    });

    let directRoot;
    if (existingRoot) {
      directRoot = await prisma.channelChat.update({
        where: { id: existingRoot.id },
        data: {
          workspaceId,
          workingTime,
          isActive: true,
          title: `Direct Assistant (${account.accountName})`,
        },
      });
    } else {
      directRoot = await prisma.channelChat.create({
        data: {
          accountId: account.id,
          platform: account.platform,
          platformChatId: rootPlatformChatId,
          title: `Direct Assistant (${account.accountName})`,
          chatType: 'DIRECT',
          workspaceId,
          workingTime,
          isActive: true,
        },
      });
    }

    // Đồng bộ quan hệ Neo4j: Độc quyền chuyển gán sang Workspace này
    const cypher = `
      MERGE (acc:ChannelAccount { id: $account_id })
      WITH acc
      OPTIONAL MATCH (acc)-[r:DIRECT_ROUTED_TO]->(:Workspace)
      DELETE r
      WITH acc
      MATCH (w:Workspace { id: $workspace_id })
      MERGE (acc)-[:DIRECT_ROUTED_TO]->(w)
      RETURN acc.id AS id
    `;
    await runCypher(cypher, {
      account_id: account.id,
      workspace_id: workspaceId,
    }).catch((err) => console.warn('[API direct-chats POST] Neo4j sync notice:', err));

    return NextResponse.json({
      success: true,
      message: 'Gán trợ lý chat cá nhân và cấu hình khung giờ thành công',
      data: {
        id: directRoot.id,
        account_id: account.id,
        workspace_id: workspaceId,
        working_time: workingTime,
      },
    });
  } catch (error) {
    console.error('[API direct-chats POST] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi thiết lập trợ lý chat cá nhân' },
      { status: 500 }
    );
  }
}
