import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/services/user.service';
import { comparePassword, signToken, COOKIE_NAME } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { identifier, password } = await req.json();

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Identifier and password are required' },
        { status: 400 }
      );
    }

    // 1. Find user by username, email, or zalo_id
    const user = await UserService.getUserByUsername(identifier);

    if (!user || !user.password_hash) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // 2. Compare password
    const isValid = await comparePassword(password, user.password_hash);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // 3. Create payload
    const payload = {
      id: user.id,
      zalo_id: user.zalo_id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
    };

    // 4. Sign token
    const token = await signToken(payload);

    // 5. Create Response and set cookie
    const response = NextResponse.json({
      success: true,
      user: payload
    });

    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
