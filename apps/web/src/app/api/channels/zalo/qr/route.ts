import { NextResponse } from 'next/server';
import { ZaloChannelAdapter } from '@omniagent/channels';

export async function POST(): Promise<NextResponse> {
  try {
    const session = await ZaloChannelAdapter.generateQrSession();
    return NextResponse.json({
      success: true,
      data: session,
    });
  } catch (error) {
    console.error('[API /api/channels/zalo/qr] Error generating QR:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate Zalo QR code' },
      { status: 500 }
    );
  }
}
