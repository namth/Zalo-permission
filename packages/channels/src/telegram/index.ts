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

    // Setup bot message listener
    this.bot.on('message:text', async (ctx) => {
      const chat = ctx.chat;
      const message = ctx.message;
      const sender = ctx.from;
      let text = message.text || '';

      // Xử lý trong Group Chat: chỉ nhận khi được @mention hoặc reply bot
      if (chat.type === 'group' || chat.type === 'supergroup') {
        const isReplyToBot = message.reply_to_message?.from?.username === this.botUsername;
        const mentionTag = `@${this.botUsername}`;
        const hasMention = text.includes(mentionTag);

        if (!isReplyToBot && !hasMention) {
          return; // Ignore general group chatter not addressed to bot
        }

        // Clean @mention tag from text
        text = text.replace(mentionTag, '').trim();
      }

      const inboundMsg: InboundChatMessage = {
        platform: 'TELEGRAM',
        accountId: this.accountId,
        platformChatId: String(chat.id),
        senderId: String(sender.id),
        senderName: sender.first_name || sender.username || 'User',
        messageId: String(message.message_id),
        text,
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
   * Gửi tin nhắn trả lời về nhóm chat
   */
  async sendMessage(platformChatId: string, text: string): Promise<void> {
    await this.bot.api.sendMessage(platformChatId, text);
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
