import { NextRequest, NextResponse } from 'next/server';
import { WebhookService } from '@/services/webhook.service';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; webhook_id: string } }
): Promise<NextResponse> {
  try {
    const body = await req.json();
    const updated = await WebhookService.updateWebhook(params.id, params.webhook_id, {
      name: body.name,
      description: body.description,
      isActive: body.isActive,
    });

    return NextResponse.json({
      success: true,
      message: 'Cập nhật webhook thành công',
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update webhook' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; webhook_id: string } }
): Promise<NextResponse> {
  try {
    await WebhookService.deleteWebhook(params.id, params.webhook_id);
    return NextResponse.json({
      success: true,
      message: 'Xóa webhook thành công',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete webhook' },
      { status: 500 }
    );
  }
}
