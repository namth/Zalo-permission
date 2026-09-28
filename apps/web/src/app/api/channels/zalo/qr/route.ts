import { NextRequest, NextResponse } from 'next/server';
import { ZaloChannelAdapter } from '@omniagent/channels';
import { ensureWorkspacesSchema } from '@/lib/db';

export async function POST(): Promise<NextResponse> {
  try {
    await ensureWorkspacesSchema().catch((err) => {
      console.warn('[API /api/channels/zalo/qr] ensureWorkspacesSchema notice:', err?.message);
    });

    const session = await ZaloChannelAdapter.generateQrSession();
    return NextResponse.json({
      success: true,
      data: session,
    });
  } catch (error: any) {
    console.error('[API /api/channels/zalo/qr] Error generating QR:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to generate Zalo QR code' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ success: false, error: 'Missing sessionId' }, { status: 400 });
  }

  const session = ZaloChannelAdapter.getQrSessionStatus(sessionId);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Session not found or expired' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: session,
  });
}
