
import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/services/user.service';
import { signToken, COOKIE_NAME } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password, full_name, email } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // 1. Create user with default role 'user'
    const user = await UserService.createUser({
      username,
      password,
      full_name,
      email,
      role: 'user'
    });

    // 2. Automatically log them in
    const payload = {
      id: user.id,
      zalo_id: user.zalo_id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
    };

    const token = await signToken(payload);

    const response = NextResponse.json({
      success: true,
      user: payload,
      message: 'Account created successfully'
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
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
