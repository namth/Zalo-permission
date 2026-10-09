import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@omniagent/database';
import { ContactService, type ContactRole } from '@omniagent/core';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/contacts/[id]
 */
export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const contact = await ContactService.getById(params.id);
    if (!contact) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy liên hệ' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: contact });
  } catch (error: any) {
    logger.error(`[API] GET /api/contacts/${params.id} error: ${error?.message || error}`);
    return NextResponse.json({ success: false, error: error?.message || 'Lỗi server' }, { status: 500 });
  }
}

/**
 * PATCH /api/contacts/[id]
 */
export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const body = await req.json();
    const updated = await ContactService.updateContactInfo(params.id, {
      name: body.name,
      role: body.role as ContactRole,
      gender: body.gender,
      birthYear: body.birth_year ? parseInt(String(body.birth_year), 10) : undefined,
      email: body.email,
      phone: body.phone,
      hobbies: body.hobbies,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    logger.error(`[API] PATCH /api/contacts/${params.id} error: ${error?.message || error}`);
    return NextResponse.json({ success: false, error: error?.message || 'Lỗi cập nhật liên hệ' }, { status: 500 });
  }
}

/**
 * DELETE /api/contacts/[id]
 */
export async function DELETE(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    await prisma.contact.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true, message: 'Đã xóa liên hệ' });
  } catch (error: any) {
    logger.error(`[API] DELETE /api/contacts/${params.id} error: ${error?.message || error}`);
    return NextResponse.json({ success: false, error: error?.message || 'Lỗi xóa liên hệ' }, { status: 500 });
  }
}
