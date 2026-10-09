import { NextRequest, NextResponse } from 'next/server';
import { ContactService } from '@omniagent/core';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/contacts/merge
 * Body: { primary_id: string, secondary_id: string }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { primary_id, secondary_id } = body;

    if (!primary_id || !secondary_id) {
      return NextResponse.json(
        { success: false, error: 'Cần cung cấp cả primary_id và secondary_id để hợp nhất' },
        { status: 400 }
      );
    }

    const merged = await ContactService.mergeContacts(primary_id, secondary_id);

    return NextResponse.json({
      success: true,
      message: `Đã hợp nhất thành công vào Contact [${merged.name}]`,
      data: merged,
    });
  } catch (error: any) {
    logger.error(`[API] POST /api/contacts/merge error: ${error?.message || error}`);
    return NextResponse.json(
      { success: false, error: error?.message || 'Lỗi hợp nhất danh bạ' },
      { status: 400 }
    );
  }
}
