
import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/services/user.service';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check (Admin only)
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { targetId, sourceId } = await req.json();

    if (!targetId || !sourceId) {
      return NextResponse.json({ error: 'targetId and sourceId are required' }, { status: 400 });
    }

    const result = await UserService.mergeUsers(targetId, sourceId, payload.id);

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Users merged successfully'
    });
  } catch (error: any) {
    console.error('Merge error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
