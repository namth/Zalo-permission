import { NextRequest, NextResponse } from 'next/server';
import { prisma, runCypher } from '@omniagent/database';
import { ContactService, type ContactRole } from '@omniagent/core';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/contacts
 * Query params: workspace_id, query, limit, page
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = req.nextUrl;
    const workspaceId = searchParams.get('workspace_id');
    const query = searchParams.get('query')?.trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const skip = (page - 1) * limit;

    let contactIdsInWs: string[] | null = null;
    if (workspaceId) {
      const neoResult = await runCypher<{ id: string }>(
        `MATCH (c:Contact)-[:BELONGS_TO]->(w:Workspace { id: $workspaceId }) RETURN c.id AS id`,
        { workspaceId }
      );
      contactIdsInWs = neoResult.map((r) => r.id);
    }

    const where: any = {
      ...(contactIdsInWs !== null ? { id: { in: contactIdsInWs } } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { phone: { contains: query } },
              { email: { contains: query, mode: 'insensitive' } },
              { zaloId: { contains: query } },
              { telegramId: { contains: query } },
            ],
          }
        : {}),
    };

    const [total, contacts] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        take: limit,
        skip,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error(`[API] GET /api/contacts error: ${error?.message || error}`);
    return NextResponse.json({ success: false, error: error?.message || 'Lỗi lấy danh bạ' }, { status: 500 });
  }
}

/**
 * POST /api/contacts - Tạo mới một Contact
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { name, zalo_id, telegram_id, role = 'USER', workspace_id, gender, birth_year, email, phone, hobbies } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Họ và tên là bắt buộc.' }, { status: 400 });
    }

    const contact = await ContactService.createContact({
      name,
      zaloId: zalo_id,
      telegramId: telegram_id,
      role: role as ContactRole,
      workspaceId: workspace_id,
      gender,
      birthYear: birth_year ? parseInt(String(birth_year), 10) : undefined,
      email,
      phone,
      hobbies,
    });

    return NextResponse.json({ success: true, data: contact }, { status: 201 });
  } catch (error: any) {
    logger.error(`[API] POST /api/contacts error: ${error?.message || error}`);
    return NextResponse.json({ success: false, error: error?.message || 'Lỗi tạo liên hệ' }, { status: 500 });
  }
}
