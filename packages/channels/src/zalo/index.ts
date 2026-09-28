import type { InboundChatMessage } from '@omniagent/core';

export interface ZaloAccountConfig {
  accountId: string;
  authType: 'QR_SESSION' | 'OA_SECRET';
  credentials: Record<string, string>;
  onMessageReceived?: (msg: InboundChatMessage) => Promise<void>;
}

export class ZaloChannelAdapter {
  private accountId: string;
  private config: ZaloAccountConfig;

  constructor(config: ZaloAccountConfig) {
    this.accountId = config.accountId;
    this.config = config;
  }

  /**
   * Khởi động lắng nghe kết nối Zalo
   */
  async start(): Promise<void> {
    console.log(`[ZaloAdapter] Initializing Zalo Account (${this.config.authType}): ${this.accountId}`);
    // Sẵn sàng kết nối WebSocket zca-js hoặc Webhook Zalo OA
  }

  /**
   * Gửi tin nhắn trả lời về nhóm Zalo
   */
  async sendMessage(platformChatId: string, text: string): Promise<void> {
    console.log(`[ZaloAdapter] Sending message to Zalo Thread ${platformChatId}: ${text.slice(0, 50)}...`);
    // Gửi qua zca-js hoặc Zalo OA API
  }

  /**
   * Khởi tạo phiên quét mã QR
   */
  static async generateQrSession(): Promise<{ sessionId: string; qrDataUrl: string; expiresIn: number }> {
    const sessionId = `zalo_qr_${Date.now()}`;
    return {
      sessionId,
      qrDataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="%23f0f0f0"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-size="14" fill="%23333">Zalo QR Simulator</text></svg>',
      expiresIn: 60,
    };
  }
}
