import { NextRequest, NextResponse } from 'next/server';
import { WebhookService } from '@/services/webhook.service';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const config = await WebhookService.getFirebaseConfig(params.id);
    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get Firebase config' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const body = await req.json();
    if (!body.service_account_json || !body.project_id || !body.client_email) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: project_id, client_email, service_account_json',
        },
        { status: 400 }
      );
    }

    const saved = await WebhookService.saveFirebaseConfig(params.id, {
      projectId: body.project_id,
      clientEmail: body.client_email,
      serviceAccountJson: body.service_account_json,
      isActive: body.is_active !== undefined ? body.is_active : true,
    });

    return NextResponse.json({
      success: true,
      message: 'Cấu hình Firebase FCM đã được mã hóa AES-256-GCM và lưu thành công.',
      data: saved,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save Firebase config' },
      { status: 500 }
    );
  }
}
