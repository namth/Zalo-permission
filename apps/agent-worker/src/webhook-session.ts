import { prisma } from '@omniagent/database';
import type { ConversationHistoryMessage } from '@omniagent/core';

export class WebhookSessionManager {
  /**
   * Lấy lịch sử hội thoại của Webhook Session
   */
  static async getSessionHistory(
    webhookId: string,
    sessionId: string
  ): Promise<ConversationHistoryMessage[]> {
    try {
      const session = await prisma.webhookSession.findUnique({
        where: {
          webhookId_sessionId: {
            webhookId,
            sessionId,
          },
        },
      });

      if (!session || !Array.isArray(session.messages)) {
        return [];
      }

      return (session.messages as any[])
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          senderName: m.senderName,
        }));
    } catch (err) {
      console.warn(`[WebhookSession] Failed to read session history for ${webhookId}/${sessionId}:`, err);
      return [];
    }
  }

  /**
   * Cập nhật thêm một lượt trao đổi vào Webhook Session
   */
  static async saveSessionTurn(params: {
    webhookId: string;
    sessionId: string;
    senderId: string;
    userPrompt: string;
    assistantResponse: string;
    senderName?: string;
  }): Promise<void> {
    const { webhookId, sessionId, senderId, userPrompt, assistantResponse, senderName } = params;

    try {
      const existing = await prisma.webhookSession.findUnique({
        where: {
          webhookId_sessionId: {
            webhookId,
            sessionId,
          },
        },
      });

      const currentMessages: any[] = Array.isArray(existing?.messages) ? (existing?.messages as any[]) : [];

      const newMessages = [
        ...currentMessages,
        {
          role: 'user',
          content: userPrompt,
          senderName,
          timestamp: new Date().toISOString(),
        },
        {
          role: 'assistant',
          content: assistantResponse,
          timestamp: new Date().toISOString(),
        },
      ];

      // Giới hạn 20 tin nhắn gần nhất để tối ưu context window
      const trimmedMessages = newMessages.slice(-20);

      await prisma.webhookSession.upsert({
        where: {
          webhookId_sessionId: {
            webhookId,
            sessionId,
          },
        },
        create: {
          webhookId,
          sessionId,
          senderId,
          messages: trimmedMessages,
          lastActiveAt: new Date(),
        },
        update: {
          messages: trimmedMessages,
          lastActiveAt: new Date(),
        },
      });

      console.log(`[WebhookSession] Saved turn for session ${sessionId} (Total messages: ${trimmedMessages.length})`);
    } catch (err) {
      console.error(`[WebhookSession] Failed to save session turn for ${sessionId}:`, err);
    }
  }
}
