import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@omniagent/database';
import { getRedisClient, INBOUND_STREAM } from '@/lib/redis';
import type { InboundChatMessage } from '@omniagent/core';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; webhook_id: string } }
): Promise<NextResponse> {
  try {
    const workspaceId = params.id;
    const webhookId = params.webhook_id;

    // 1. Kiểm tra Secret Token từ Header (Bearer hoặc X-Webhook-Secret)
    const authHeader = request.headers.get('authorization') || '';
    const secretHeader = request.headers.get('x-webhook-secret') || '';

    let clientSecret = secretHeader.trim();
    if (!clientSecret && authHeader.toLowerCase().startsWith('bearer ')) {
      clientSecret = authHeader.slice(7).trim();
    }

    if (!clientSecret) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized: Missing secret token. Provide via Authorization: Bearer <token> or X-Webhook-Secret header.',
        },
        { status: 401 }
      );
    }

    // 2. Tra cứu Webhook trong Database
    const webhook = await prisma.workspaceWebhook.findFirst({
      where: {
        id: webhookId,
        workspaceId,
      },
    });

    if (!webhook) {
      return NextResponse.json(
        {
          success: false,
          error: 'Webhook endpoint not found for this workspace.',
        },
        { status: 404 }
      );
    }

    if (!webhook.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: This webhook is currently disabled.',
        },
        { status: 403 }
      );
    }

    if (webhook.secretToken !== clientSecret) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized: Invalid webhook secret token.',
        },
        { status: 401 }
      );
    }

    // 3. Đọc và Kiểm tra Request Body
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON request body.',
        },
        { status: 400 }
      );
    }

    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const senderId = typeof body.sender_id === 'string' ? body.sender_id.trim() : '';

    if (!prompt) {
      return NextResponse.json(
        {
          success: false,
          error: 'Field "prompt" is required and cannot be empty.',
        },
        { status: 400 }
      );
    }

    if (!senderId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Field "sender_id" is required to identify the client user.',
        },
        { status: 400 }
      );
    }

    // 4. Chuẩn hóa session_id (nếu không truyền thì tự sinh theo kênh: wh_{webhookId}_{senderId})
    const sessionId = (body.session_id && typeof body.session_id === 'string' && body.session_id.trim())
      ? body.session_id.trim()
      : `wh_${webhookId.slice(0, 8)}_${senderId}`;

    // 5. Kiểm tra thông tin Callback (nếu có)
    let callbackConfig: InboundChatMessage['callback'] = undefined;
    if (body.callback && typeof body.callback === 'object') {
      const cbType = String(body.callback.type || '').toUpperCase();
      if (cbType === 'HTTP_POST') {
        const cbUrl = String(body.callback.url || '').trim();
        if (!cbUrl.startsWith('http://') && !cbUrl.startsWith('https://')) {
          return NextResponse.json(
            {
              success: false,
              error: 'Invalid callback.url: must be a valid HTTP or HTTPS URL.',
            },
            { status: 400 }
          );
        }
        callbackConfig = {
          type: 'HTTP_POST',
          url: cbUrl,
        };
      } else if (cbType === 'FIREBASE_FCM') {
        const fcmToken = String(body.callback.fcm_token || body.callback.fcmToken || '').trim();
        if (!fcmToken) {
          return NextResponse.json(
            {
              success: false,
              error: 'Missing callback.fcm_token for FIREBASE_FCM callback type.',
            },
            { status: 400 }
          );
        }
        callbackConfig = {
          type: 'FIREBASE_FCM',
          fcmToken,
        };
      }
    }

    const jobId = `job_${randomUUID()}`;

    // 6. Đóng gói InboundChatMessage theo chuẩn Core
    const inboundMessage: InboundChatMessage = {
      platform: 'WEBHOOK',
      platformChatId: sessionId,
      senderId,
      senderName: typeof body.sender_name === 'string' ? body.sender_name.trim() : senderId,
      messageId: jobId,
      text: prompt,
      isGroup: false,
      timestamp: Date.now(),
      workspaceId,
      webhookId,
      sessionId,
      callback: callbackConfig,
    };

    // 7. Đẩy Message vào hàng đợi Redis Streams
    const redis = getRedisClient();
    await redis.xadd(INBOUND_STREAM, '*', 'data', JSON.stringify(inboundMessage));

    // 8. Trả về ngay lập tức HTTP 202 Accepted
    return NextResponse.json(
      {
        success: true,
        message: 'Message accepted and queued for agent processing',
        data: {
          job_id: jobId,
          session_id: sessionId,
          status: 'QUEUED',
          received_at: new Date().toISOString(),
        },
      },
      { status: 202 }
    );
  } catch (error: any) {
    console.error('[Inbound Webhook API Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal Server Error',
      },
      { status: 500 }
    );
  }
}
