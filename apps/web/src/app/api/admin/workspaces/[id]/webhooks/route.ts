import { NextRequest, NextResponse } from 'next/server';
import { WebhookService } from '@/services/webhook.service';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const webhooks = await WebhookService.listWebhooks(params.id);
    return NextResponse.json({
      success: true,
      data: webhooks,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list webhooks' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const body = await req.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Tên webhook không được để trống' },
        { status: 400 }
      );
    }

    const created = await WebhookService.createWebhook(params.id, {
      name: body.name,
      description: body.description,
      isActive: body.isActive !== undefined ? body.isActive : true,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Tạo Webhook thành công',
        data: created,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create webhook' },
      { status: 500 }
    );
  }
}
