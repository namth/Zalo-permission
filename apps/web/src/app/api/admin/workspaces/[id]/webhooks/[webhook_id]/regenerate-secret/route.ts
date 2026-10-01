import { NextRequest, NextResponse } from 'next/server';
import { WebhookService } from '@/services/webhook.service';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; webhook_id: string } }
): Promise<NextResponse> {
  try {
    const result = await WebhookService.regenerateSecret(params.id, params.webhook_id);
    return NextResponse.json({
      success: true,
      message: 'Secret token đã được làm mới thành công',
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to regenerate secret' },
      { status: 500 }
    );
  }
}
