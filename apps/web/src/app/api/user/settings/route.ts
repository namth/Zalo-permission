import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/services/user.service';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET: Fetch current user's settings (profile and API token)
 */
export async function GET(req: NextRequest) {
  try {
    const userPayload = await getCurrentUser(req);

    if (!userPayload) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = await UserService.getUserById(userPayload.id);

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Return profile without sensitive password_hash, but including api_token
    const { password_hash, ...settings } = user;

    return NextResponse.json({
      success: true,
      data: settings
    });
  } catch (error) {
    logger.error(`GET /api/user/settings error: ${error}`);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST: Reroll API Token
 */
export async function POST(req: NextRequest) {
  try {
    const userPayload = await getCurrentUser(req);

    if (!userPayload) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await req.json();

    if (action === 'reroll_token') {
      const newToken = await UserService.rerollApiToken(userPayload.id);
      return NextResponse.json({
        success: true,
        message: 'API token regenerated successfully',
        api_token: newToken
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    logger.error(`POST /api/user/settings error: ${error}`);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
