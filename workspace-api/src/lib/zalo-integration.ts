/**
 * Zalo Integration Helper
 * Handles Zalo webhook events and forwards to n8n Planner workflow
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from './logger';
import crypto from 'crypto';

export interface ZaloWebhookPayload {
  event_type: 'user_sent_text' | 'user_sent_image' | 'user_sent_file' | 'bot_command';
  thread_id: string;
  sender_id: string;
  message_content?: string;
  message_id?: string;
  timestamp: number;
}

export interface ZaloUserInfo {
  user_id: string;
  display_name: string;
  avatar?: string;
}

export interface ZaloGroupInfo {
  group_id: string;
  group_name: string;
  member_count: number;
}

export class ZaloIntegrationClient {
  private client: AxiosInstance;
  private accessToken: string;
  private n8nWebhookUrl: string;

  constructor() {
    this.accessToken = process.env.ZALO_ACCESS_TOKEN || '';
    this.n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/planner';

    this.client = axios.create({
      baseURL: 'https://openapi.zalo.me/v2.0',
      headers: {
        'Content-Type': 'application/json',
        'access_token': this.accessToken,
      },
    });

    logger.info('Zalo Integration Client initialized');
  }

  /**
   * Process incoming Zalo webhook
   */
  async processWebhook(payload: ZaloWebhookPayload): Promise<void> {
    try {
      logger.info(`[Zalo] Processing event: ${payload.event_type} from thread ${payload.thread_id}`);

      // Verify event type
      if (!['user_sent_text', 'bot_command'].includes(payload.event_type)) {
        logger.info(`[Zalo] Ignoring event type: ${payload.event_type}`);
        return;
      }

      // Get user info from Zalo
      const userInfo = await this.getUserInfo(payload.sender_id);

      // Forward to n8n Planner workflow
      const n8nPayload = {
        thread_id: payload.thread_id,
        user_id: payload.sender_id,
        user_message: payload.message_content || 'No message',
        timestamp: payload.timestamp,
        source: 'zalo',
        user_info: userInfo,
      };

      await this.forwardToN8n(n8nPayload);

      logger.info(`[Zalo] Event forwarded to n8n for processing`);
    } catch (error) {
      logger.error(`[Zalo] Failed to process webhook: ${error}`);
      throw error;
    }
  }

  /**
   * Get user information from Zalo
   */
  async getUserInfo(userId: string): Promise<ZaloUserInfo> {
    try {
      const response = await this.client.get(`/user/${userId}/info`);

      return {
        user_id: userId,
        display_name: response.data.display_name || 'Unknown',
        avatar: response.data.avatar,
      };
    } catch (error) {
      logger.warn(`[Zalo] Failed to get user info: ${error}`);

      return {
        user_id: userId,
        display_name: 'Unknown User',
      };
    }
  }

  /**
   * Get group information from Zalo
   */
  async getGroupInfo(threadId: string): Promise<ZaloGroupInfo> {
    try {
      const response = await this.client.get(`/group/${threadId}/info`);

      return {
        group_id: threadId,
        group_name: response.data.group_name || 'Unknown Group',
        member_count: response.data.member_count || 0,
      };
    } catch (error) {
      logger.warn(`[Zalo] Failed to get group info: ${error}`);

      return {
        group_id: threadId,
        group_name: 'Unknown Group',
        member_count: 0,
      };
    }
  }

  /**
   * Send message to Zalo thread
   */
  async sendMessage(threadId: string, text: string): Promise<string> {
    try {
      const response = await this.client.post('/message/text', {
        recipient: {
          thread_id: threadId,
        },
        message: {
          text: text,
        },
      });

      logger.info(`[Zalo] Message sent to thread ${threadId}`);
      return response.data.message_id;
    } catch (error) {
      logger.error(`[Zalo] Failed to send message: ${error}`);
      throw error;
    }
  }

  /**
   * Send typing indicator to Zalo
   */
  async sendTypingIndicator(threadId: string): Promise<void> {
    try {
      await this.client.post('/message/typing', {
        recipient: {
          thread_id: threadId,
        },
      });

      logger.debug(`[Zalo] Typing indicator sent to thread ${threadId}`);
    } catch (error) {
      logger.warn(`[Zalo] Failed to send typing indicator: ${error}`);
    }
  }

  /**
   * Forward webhook payload to n8n Planner workflow
   */
  private async forwardToN8n(payload: any): Promise<void> {
    try {
      const response = await axios.post(this.n8nWebhookUrl, payload, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'X-Source': 'zalo-integration',
        },
      });

      logger.info(`[Zalo→n8n] Forwarded successfully, response: ${response.status}`);
    } catch (error) {
      logger.error(`[Zalo→n8n] Failed to forward to n8n: ${error}`);
      throw error;
    }
  }

  /**
   * Verify Zalo webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const secret = process.env.ZALO_WEBHOOK_SECRET || '';
      const hash = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      return hash === signature;
    } catch (error) {
      logger.error(`[Zalo] Signature verification failed: ${error}`);
      return false;
    }
  }

  /**
   * Handle Zalo webhook callback (after n8n processing)
   */
  async handleN8nCallback(threadId: string, message: string): Promise<void> {
    try {
      logger.info(`[n8n→Zalo] Sending callback message to thread ${threadId}`);

      await this.sendMessage(threadId, message);

      logger.info(`[n8n→Zalo] Callback sent successfully`);
    } catch (error) {
      logger.error(`[n8n→Zalo] Failed to send callback: ${error}`);
      throw error;
    }
  }
}

// Export singleton instance
export const zaloClient = new ZaloIntegrationClient();
