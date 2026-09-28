import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/services/user.service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Internal endpoint to verify persistent API tokens.
 * This is called by the middleware to handle authentication for non-JWT tokens.
 */
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token || !token.startsWith('zp_')) {
      return NextResponse.json({ success: false, error: 'Invalid token format' }, { status: 400 });
    }

    const user = await UserService.getUserByApiToken(token);

    if (!user) {
      return NextResponse.json({ success: false, error: 'Token not found or invalid' }, { status: 401 });
    }

    if (user.status !== 'active') {
      return NextResponse.json({ success: false, error: 'User is inactive' }, { status: 403 });
    }

    // Return the same payload structure as the JWT
    const payload = {
      id: user.id,
      zalo_id: user.zalo_id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
    };

    return NextResponse.json({
      success: true,
      user: payload
    });
  } catch (error) {
    logger.error(`verify-api-token error: ${error}`);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
