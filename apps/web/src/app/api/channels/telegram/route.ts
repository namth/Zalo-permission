import { NextRequest, NextResponse } from 'next/server';
import { prisma, encryptData, runCypher } from '@omniagent/database';
import { TelegramChannelAdapter } from '@omniagent/channels';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { bot_token } = body;

    if (!bot_token || typeof bot_token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'bot_token is required' },
        { status: 400 }
      );
    }

    // Verify token with Telegram API
    const verification = await TelegramChannelAdapter.verifyToken(bot_token);
    if (!verification.isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid Telegram Bot Token. Cannot verify with Telegram API.' },
        { status: 400 }
      );
    }

    const encryptedCredentials = encryptData(bot_token);
    const accountName = `@${verification.username || 'Bot'} (${verification.name || 'Telegram Bot'})`;

    // Save to PostgreSQL
    const account = await prisma.channelAccount.create({
      data: {
        platform: 'TELEGRAM',
        accountName,
        authType: 'BOT_TOKEN',
        encryptedCredentials,
        status: 'ACTIVE',
        lastSyncedAt: new Date(),
        metadata: {
          username: verification.username,
          first_name: verification.name,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Telegram Bot connected successfully',
      data: {
        account_id: account.id,
        account_name: account.accountName,
        platform: account.platform,
      },
    });
  } catch (error) {
    console.error('[API /api/channels/telegram] Error connecting bot:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to connect Telegram Bot' },
      { status: 500 }
    );
  }
}
