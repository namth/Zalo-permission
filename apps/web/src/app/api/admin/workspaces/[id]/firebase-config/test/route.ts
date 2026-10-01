import { NextRequest, NextResponse } from 'next/server';
import { WebhookService } from '@/services/webhook.service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    if (!body.service_account_json) {
      return NextResponse.json(
        { success: false, error: 'service_account_json is required' },
        { status: 400 }
      );
    }

    const result = await WebhookService.testFirebaseCredentials(body.service_account_json);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Firebase credentials test failed' },
      { status: 400 }
    );
  }
}
