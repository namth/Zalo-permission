import { NextRequest, NextResponse } from 'next/server';
import { copilotService, CopilotMessage } from '@/services/copilot.service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { message, history = [] } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { success: false, error: 'Tin nhắn không được để trống' },
        { status: 400 }
      );
    }

    const messages: CopilotMessage[] = [
      ...history.slice(-10), // Giữ tối đa 10 tin nhắn gần nhất trong context
      { role: 'user', content: message.trim() },
    ];

    logger.info(`[Copilot API] Processing chat message: "${message.substring(0, 60)}..."`);
    const result = await copilotService.chat(messages);

    return NextResponse.json({
      success: true,
      reply: result.reply,
      action_preview: result.action_preview || null,
    });
  } catch (error: any) {
    logger.error(`[Copilot API Error] ${error.message}`);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Lỗi khi kết nối với AI Copilot',
      },
      { status: 500 }
    );
  }
}
