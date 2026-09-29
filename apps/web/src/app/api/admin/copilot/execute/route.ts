import { NextRequest, NextResponse } from 'next/server';
import { copilotService } from '@/services/copilot.service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { action_id, action_type, parameters } = body;

    if (!action_type || !parameters) {
      return NextResponse.json(
        { success: false, error: 'Thiếu action_type hoặc parameters' },
        { status: 400 }
      );
    }

    logger.info(`[Copilot API] Executing confirmed action: ${action_type} (${action_id})`);
    const result = await copilotService.executeAction(action_type, parameters, 'admin');

    return NextResponse.json({
      success: true,
      message: result.message,
      data: result.data || null,
    });
  } catch (error: any) {
    logger.error(`[Copilot Execute API Error] ${error.message}`);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Lỗi khi thực thi hành động',
      },
      { status: 500 }
    );
  }
}
