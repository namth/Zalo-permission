import { TelegramChannelAdapter, ZaloChannelAdapter } from '@omniagent/channels';
import { prisma, decryptData, runCypher } from '@omniagent/database';
import { getRedisClient, INBOUND_STREAM, OUTBOUND_STREAM, initStreamGroup } from './redis.js';
import type { InboundChatMessage } from '@omniagent/core';

export class ChannelGatewayManager {
  private telegramAdapters: Map<string, TelegramChannelAdapter> = new Map();
  private zaloAdapters: Map<string, ZaloChannelAdapter> = new Map();

  /**
   * Khởi động toàn bộ các tài khoản kênh đang ACTIVE trong PostgreSQL
   */
  async startAllChannels(): Promise<void> {
    const redis = getRedisClient();

    try {
      const activeAccounts = await prisma.channelAccount.findMany({
        where: { status: 'ACTIVE' },
      });

      console.log(`[ChannelManager] Found ${activeAccounts.length} active channel accounts to initialize.`);

      for (const account of activeAccounts) {
        if (account.platform === 'TELEGRAM') {
          try {
            const botToken = decryptData(account.encryptedCredentials);
            const adapter = new TelegramChannelAdapter({
              accountId: account.id,
              botToken,
              onMessageReceived: async (msg: InboundChatMessage) => {
                console.log(`[ChannelManager] Telegram message received from chat ${msg.platformChatId}: "${msg.text.slice(0, 30)}..."`);
                
                // 1. Tự động đồng bộ nhóm chat vào CSDL & Neo4j nếu chưa có
                await this.syncChatGroup(account.id, 'TELEGRAM', msg.platformChatId, msg.senderName || 'Chat Group');

                // 2. Đẩy vào hàng đợi Redis Streams
                await redis.xadd(INBOUND_STREAM, '*', 'data', JSON.stringify(msg));
              },
            });

            await adapter.start();
            this.telegramAdapters.set(account.id, adapter);
          } catch (err) {
            console.error(`[ChannelManager] Failed to start Telegram account ${account.accountName}:`, err);
          }
        } else if (account.platform === 'ZALO') {
          try {
            const credentials = JSON.parse(decryptData(account.encryptedCredentials));
            const adapter = new ZaloChannelAdapter({
              accountId: account.id,
              authType: account.authType as any,
              credentials,
              onMessageReceived: async (msg: InboundChatMessage) => {
                console.log(`[ChannelManager] Zalo message received from chat ${msg.platformChatId}`);
                await this.syncChatGroup(account.id, 'ZALO', msg.platformChatId, 'Zalo Group');
                await redis.xadd(INBOUND_STREAM, '*', 'data', JSON.stringify(msg));
              },
            });

            await adapter.start();
            this.zaloAdapters.set(account.id, adapter);
          } catch (err) {
            console.error(`[ChannelManager] Failed to start Zalo account ${account.accountName}:`, err);
          }
        }
      }
    } catch (dbErr) {
      console.warn('[ChannelManager] Notice when fetching channel accounts:', dbErr);
    }

    // Khởi chạy tiến trình Outbound Sender lắng nghe phản hồi từ Agent để gửi về Telegram/Zalo
    this.startOutboundSenderLoop().catch((err) => {
      console.error('[ChannelManager] Outbound Sender loop error:', err);
    });
  }

  /**
   * Tự động lưu nhóm chat mới vào PostgreSQL và Node (:ChannelChat) trên Neo4j
   */
  private async syncChatGroup(
    accountId: string,
    platform: 'TELEGRAM' | 'ZALO',
    platformChatId: string,
    title: string
  ): Promise<void> {
    try {
      const chat = await prisma.channelChat.upsert({
        where: {
          platform_platformChatId: {
            platform,
            platformChatId,
          },
        },
        update: {
          title,
          isActive: true,
        },
        create: {
          accountId,
          platform,
          platformChatId,
          title,
          chatType: 'GROUP',
          isActive: true,
        },
      });

      // Sync Node to Neo4j
      await runCypher(
        `
        MERGE (c:ChannelChat { id: $id })
        SET c.platform = $platform,
            c.platform_chat_id = $platform_chat_id,
            c.title = $title
        RETURN c.id
      `,
        {
          id: chat.id,
          platform,
          platform_chat_id: platformChatId,
          title,
        }
      ).catch(() => {});
    } catch (e) {
      console.warn('[ChannelManager] Notice on auto-sync chat group:', e);
    }
  }

  /**
   * Đọc từ stream:outbound_messages và gọi Adapter gửi tin nhắn trả lời vào nhóm chat
   */
  private async startOutboundSenderLoop(): Promise<void> {
    const redis = getRedisClient();
    const OUTBOUND_GROUP = 'channel_senders';
    const SENDER_ID = `sender_${process.pid}`;

    await initStreamGroup(redis, OUTBOUND_STREAM, OUTBOUND_GROUP);

    console.log(`[ChannelManager] Outbound message sender listening on ${OUTBOUND_STREAM}...`);

    while (true) {
      try {
        const response = await redis.xreadgroup(
          'GROUP',
          OUTBOUND_GROUP,
          SENDER_ID,
          'COUNT',
          5,
          'BLOCK',
          2000,
          'STREAMS',
          OUTBOUND_STREAM,
          '>'
        );

        if (!response || response.length === 0) {
          continue;
        }

        for (const [_stream, messages] of response) {
          for (const [messageId, fields] of messages) {
            try {
              const dataIndex = fields.indexOf('data');
              if (dataIndex !== -1 && fields[dataIndex + 1]) {
                const payload = JSON.parse(fields[dataIndex + 1]) as {
                  platform: 'TELEGRAM' | 'ZALO';
                  accountId: string;
                  platformChatId: string;
                  text: string;
                };

                console.log(`[ChannelManager] Sending outbound response to ${payload.platform} chat ${payload.platformChatId}...`);

                if (payload.platform === 'TELEGRAM') {
                  const adapter = this.telegramAdapters.get(payload.accountId) || Array.from(this.telegramAdapters.values())[0];
                  if (adapter) {
                    await adapter.sendMessage(payload.platformChatId, payload.text);
                  } else {
                    console.warn(`[ChannelManager] No Telegram adapter found for account ${payload.accountId}`);
                  }
                } else if (payload.platform === 'ZALO') {
                  const adapter = this.zaloAdapters.get(payload.accountId) || Array.from(this.zaloAdapters.values())[0];
                  if (adapter) {
                    await adapter.sendMessage(payload.platformChatId, payload.text);
                  }
                }
              }

              await redis.xack(OUTBOUND_STREAM, OUTBOUND_GROUP, messageId);
            } catch (err) {
              console.error(`[ChannelManager] Error delivering outbound message ${messageId}:`, err);
              await redis.xack(OUTBOUND_STREAM, OUTBOUND_GROUP, messageId);
            }
          }
        }
      } catch (loopErr) {
        console.error('[ChannelManager] Error in outbound loop, retrying in 3s:', loopErr);
        await new Promise((res) => setTimeout(res, 3000));
      }
    }
  }
}
