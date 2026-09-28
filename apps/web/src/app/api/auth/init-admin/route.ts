import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/services/user.service';

export async function GET(req: NextRequest) {
  try {
    const adminUsername = 'admin';
    const adminPassword = 'admin_password_2024';
    const adminZaloId = 'ADMIN_INTERNAL';

    const existing = await UserService.getUserByUsername(adminUsername);
    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Admin account already exists',
        username: adminUsername,
      });
    }

    const admin = await UserService.createUser({
      zalo_id: adminZaloId,
      username: adminUsername,
      password: adminPassword,
      full_name: 'System Administrator',
      role: 'admin',
    });

    return NextResponse.json({
      success: true,
      message: '✅ Admin user created successfully!',
      username: adminUsername,
      password: adminPassword,
      note: 'Please change your password after logging in.',
    });
  } catch (error: any) {
    console.error('Init admin error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to initialize admin' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
