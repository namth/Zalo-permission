import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { prisma, decryptData } from '@omniagent/database';
import type { InboundChatMessage } from '@omniagent/core';

export interface CallbackResult {
  callbackStatus: 'NONE' | 'SUCCESS' | 'CALLBACK_FAILED';
  callbackType?: 'HTTP_POST' | 'FIREBASE_FCM';
  callbackTarget?: string;
  retryCount: number;
}

export class WebhookCallbackDispatcher {
  private static firebaseApps: Map<string, App> = new Map();

  /**
   * Điều phối gửi Callback phản hồi cho Inbound Webhook
   */
  static async sendCallback(params: {
    message: InboundChatMessage;
    finalResponse: string;
    workspaceId: string;
    latencyMs: number;
    auditLogId: string;
  }): Promise<CallbackResult> {
    const { message, finalResponse, workspaceId, latencyMs, auditLogId } = params;

    if (!message.callback) {
      console.log(`[WebhookCallback] No callback configured for job ${message.messageId}. Skipping callback delivery.`);
      return { callbackStatus: 'NONE', retryCount: 0 };
    }

    const { type, url, fcmToken } = message.callback;

    // 1. Trường hợp HTTP POST Callback
    if (type === 'HTTP_POST' && url) {
      return this.sendHttpCallback({
        url,
        message,
        finalResponse,
        workspaceId,
        latencyMs,
        auditLogId,
      });
    }

    // 2. Trường hợp Firebase Cloud Messaging (FCM) Push
    if (type === 'FIREBASE_FCM' && fcmToken) {
      return this.sendFirebaseFcmPush({
        fcmToken,
        message,
        finalResponse,
        workspaceId,
        auditLogId,
      });
    }

    return { callbackStatus: 'NONE', retryCount: 0 };
  }

  /**
   * Gửi HTTP POST Callback kèm Exponential Backoff Retry (3 lần: 2s, 10s, 30s)
   */
  private static async sendHttpCallback(params: {
    url: string;
    message: InboundChatMessage;
    finalResponse: string;
    workspaceId: string;
    latencyMs: number;
    auditLogId: string;
  }): Promise<CallbackResult> {
    const { url, message, finalResponse, workspaceId, latencyMs, auditLogId } = params;

    const payload = {
      event: 'agent.response',
      job_id: message.messageId,
      session_id: message.sessionId || message.platformChatId,
      sender_id: message.senderId,
      user_prompt: message.text,
      response: finalResponse,
      status: 'SUCCESS',
      error: null,
      metadata: {
        workspace_id: workspaceId,
        webhook_id: message.webhookId,
        audit_log_id: auditLogId,
        execution_time_ms: latencyMs,
        completed_at: new Date().toISOString(),
      },
    };

    const retryDelays = [2000, 10000, 30000];
    let retriesPerformed = 0;

    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      try {
        console.log(`[WebhookCallback] Sending HTTP callback to ${url} (Attempt ${attempt + 1}/${retryDelays.length + 1})...`);
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'OmniAgent-Webhook-Delivery/1.0',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000),
        });

        if (response.ok) {
          console.log(`[WebhookCallback] ✓ Callback delivered successfully to ${url} with status ${response.status}`);
          return {
            callbackStatus: 'SUCCESS',
            callbackType: 'HTTP_POST',
            callbackTarget: url,
            retryCount: retriesPerformed,
          };
        }
      } catch (err: any) {
        retriesPerformed++;
        console.warn(`[WebhookCallback] ✗ Attempt ${attempt + 1} failed: ${err.message}`);
        if (attempt < retryDelays.length) {
          const delay = retryDelays[attempt];
          console.log(`[WebhookCallback] Waiting ${delay / 1000}s before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`[WebhookCallback] ✗ All ${retryDelays.length} retry attempts exhausted for ${url}`);
    return {
      callbackStatus: 'CALLBACK_FAILED',
      callbackType: 'HTTP_POST',
      callbackTarget: url,
      retryCount: retriesPerformed,
    };
  }

  /**
   * Gửi Push Notification qua Firebase FCM
   */
  private static async sendFirebaseFcmPush(params: {
    fcmToken: string;
    message: InboundChatMessage;
    finalResponse: string;
    workspaceId: string;
    auditLogId: string;
  }): Promise<CallbackResult> {
    const { fcmToken, message, finalResponse, workspaceId, auditLogId } = params;

    try {
      // 1. Lấy Firebase config của Workspace từ DB
      const fbConfig = await prisma.workspaceFirebaseConfig.findUnique({
        where: { workspaceId },
      });

      if (!fbConfig || !fbConfig.isActive) {
        console.warn(`[WebhookCallback] Firebase FCM is not configured or disabled for workspace ${workspaceId}`);
        return {
          callbackStatus: 'CALLBACK_FAILED',
          callbackType: 'FIREBASE_FCM',
          callbackTarget: fcmToken.slice(0, 15) + '...',
          retryCount: 0,
        };
      }

      // 2. Lấy hoặc Khởi tạo Firebase App từ cache
      let app = this.firebaseApps.get(workspaceId);
      if (!app) {
        const rawJson = decryptData(fbConfig.encryptedCredentials);
        const credentials = JSON.parse(rawJson);
        const appName = `ws_firebase_${workspaceId}`;

        // Kiểm tra xem app đã tồn tại trong admin SDK chưa
        const existingApp = getApps().find((a) => a?.name === appName);
        if (existingApp) {
          app = existingApp;
        } else {
          app = initializeApp(
            {
              credential: cert(credentials),
              projectId: fbConfig.projectId,
            },
            appName
          );
        }
        this.firebaseApps.set(workspaceId, app);
      }

      // 3. Gửi FCM Push
      console.log(`[WebhookCallback] Sending Firebase FCM message to token ${fcmToken.slice(0, 15)}...`);
      await getMessaging(app).send({
        token: fcmToken,
        notification: {
          title: 'Phản hồi từ AI Assistant',
          body: finalResponse.length > 100 ? `${finalResponse.slice(0, 100)}...` : finalResponse,
        },
        data: {
          event: 'agent.response',
          job_id: message.messageId,
          session_id: message.sessionId || message.platformChatId,
          sender_id: message.senderId,
          response: finalResponse,
          workspace_id: workspaceId,
          audit_log_id: auditLogId,
        },
      });

      console.log(`[WebhookCallback] ✓ Firebase FCM push sent successfully to device`);
      return {
        callbackStatus: 'SUCCESS',
        callbackType: 'FIREBASE_FCM',
        callbackTarget: fcmToken.slice(0, 15) + '...',
        retryCount: 0,
      };
    } catch (err: any) {
      console.error(`[WebhookCallback] ✗ Failed to send Firebase FCM push:`, err);
      return {
        callbackStatus: 'CALLBACK_FAILED',
        callbackType: 'FIREBASE_FCM',
        callbackTarget: fcmToken.slice(0, 15) + '...',
        retryCount: 0,
      };
    }
  }
}
