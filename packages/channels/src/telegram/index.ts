import { Bot } from 'grammy';
import type { InboundChatMessage } from '@omniagent/core';

export interface TelegramBotConfig {
  accountId: string;
  botToken: string;
  onMessageReceived?: (msg: InboundChatMessage) => Promise<void>;
}

export class TelegramChannelAdapter {
  private bot: Bot;
  private accountId: string;
  private botUsername = '';

  constructor(config: TelegramBotConfig) {
    this.accountId = config.accountId;
    this.bot = new Bot(config.botToken);

    // Setup bot message listener (support both text and photo)
    this.bot.on(['message:text', 'message:photo'], async (ctx) => {
      const chat = ctx.chat;
      const message = ctx.message;
      const sender = ctx.from;
      let text = message.text || message.caption || '';
      const isGroup = chat.type === 'group' || chat.type === 'supergroup';

      // Bóc tách Tin Nhắn Được Tag / Reply
      let quotedMessage: any = undefined;
      if (message.reply_to_message) {
        const replyMsg = message.reply_to_message;
        const replyText = replyMsg.text || (replyMsg as any).caption || '';
        if (replyText) {
          quotedMessage = {
            messageId: String(replyMsg.message_id),
            senderId: String(replyMsg.from?.id || ''),
            senderName: replyMsg.from?.first_name || replyMsg.from?.username || 'Thành viên nhóm',
            text: replyText,
          };
        }
      }

      // Bóc tách Hình Ảnh (Photo)
      const mediaUrls: string[] = [];
      if (message.photo && message.photo.length > 0) {
        try {
          const largestPhoto = message.photo[message.photo.length - 1];
          const file = await ctx.api.getFile(largestPhoto.file_id);
          if (file.file_path) {
            mediaUrls.push(`https://api.telegram.org/file/bot${this.bot.token}/${file.file_path}`);
          }
        } catch (e) {
          console.warn('[TelegramAdapter] Failed to get file path for photo:', e);
        }
      }

      if (!text.trim() && mediaUrls.length > 0) {
        text = '[Hình ảnh đính kèm]';
      }

      const inboundMsg: InboundChatMessage = {
        platform: 'TELEGRAM',
        accountId: this.accountId,
        platformChatId: String(chat.id),
        senderId: String(sender.id),
        senderName: sender.first_name || sender.username || 'User',
        messageId: String(message.message_id),
        text,
        isGroup,
        quotedMessage,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
        timestamp: message.date * 1000,
      };

      if (config.onMessageReceived) {
        await config.onMessageReceived(inboundMsg);
      }
    });
  }

  /**
   * Khởi động lắng nghe bot (Polling mode)
   */
  async start(): Promise<void> {
    const me = await this.bot.api.getMe();
    this.botUsername = me.username || '';
    console.log(`[TelegramAdapter] Bot started: @${this.botUsername} (${me.first_name})`);
    this.bot.start();
  }

  /**
   * Dừng bot
   */
  async stop(): Promise<void> {
    await this.bot.stop();
  }

  /**
   * Gửi tin nhắn trả lời về nhóm chat (hỗ trợ gửi kèm ảnh như VietQR, hình ảnh hóa đơn)
   */
  async sendMessage(platformChatId: string, text: string, mediaUrls?: string[]): Promise<void> {
    if (mediaUrls && mediaUrls.length > 0) {
      let isCaptionSent = false;
      for (const url of mediaUrls) {
        try {
          if (!isCaptionSent && text && text.length <= 1024) {
            await this.bot.api.sendPhoto(platformChatId, url, { caption: text });
            isCaptionSent = true;
          } else {
            await this.bot.api.sendPhoto(platformChatId, url);
          }
        } catch (photoErr) {
          console.warn(`[TelegramAdapter] Failed to send photo ${url}:`, photoErr);
        }
      }
      if (isCaptionSent) return;
    }

    if (text) {
      await this.bot.api.sendMessage(platformChatId, text);
    }
  }

  /**
   * Kiểm tra token hợp lệ
   */
  static async verifyToken(botToken: string): Promise<{ isValid: boolean; username?: string; name?: string }> {
    try {
      const testBot = new Bot(botToken);
      const me = await testBot.api.getMe();
      return {
        isValid: true,
        username: me.username,
        name: me.first_name,
      };
    } catch {
      return { isValid: false };
    }
  }
}
