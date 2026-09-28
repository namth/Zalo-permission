import { Zalo, ThreadType, LoginQRCallbackEventType, type API, type Credentials } from 'zca-js';
import { prisma, encryptData } from '@omniagent/database';
import type { InboundChatMessage } from '@omniagent/core';

export type QrSessionStatus = 'INITIALIZING' | 'GENERATED' | 'SCANNED' | 'EXPIRED' | 'DECLINED' | 'COMPLETED' | 'ERROR';

export interface ZaloQrSessionState {
  sessionId: string;
  status: QrSessionStatus;
  qrDataUrl?: string;
  user?: {
    name: string;
    avatar: string;
  };
  accountId?: string;
  error?: string;
  createdAt: number;
}

// In-memory active QR login sessions
const activeQrSessions = new Map<string, ZaloQrSessionState>();

// Periodic cleanup of sessions older than 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of activeQrSessions.entries()) {
    if (now - session.createdAt > 10 * 60 * 1000) {
      activeQrSessions.delete(id);
    }
  }
}, 60 * 1000);

export interface ZaloAccountConfig {
  accountId: string;
  authType: 'QR_SESSION' | 'OA_SECRET';
  credentials: Record<string, any>;
  onMessageReceived?: (msg: InboundChatMessage) => Promise<void>;
}

export class ZaloChannelAdapter {
  private accountId: string;
  private config: ZaloAccountConfig;
  private api: API | null = null;
  private ownId: string | null = null;

  constructor(config: ZaloAccountConfig) {
    this.accountId = config.accountId;
    this.config = config;
  }

  /**
   * Khởi động lắng nghe kết nối Zalo
   */
  async start(): Promise<void> {
    console.log(`[ZaloAdapter] Initializing Zalo Account (${this.config.authType}): ${this.accountId}`);

    if (this.config.authType === 'QR_SESSION') {
      try {
        const zalo = new Zalo({
          selfListen: false,
          checkUpdate: false,
          logging: false,
        });

        const credentials = this.config.credentials as Credentials;
        if (!credentials || !credentials.cookie || !credentials.imei) {
          throw new Error('Invalid Zalo QR session credentials');
        }

        this.api = await zalo.login(credentials);
        this.ownId = this.api.getOwnId();
        console.log(`[ZaloAdapter] Logged in successfully to Zalo account! User UID: ${this.ownId}`);

        // Đăng ký nhận tin nhắn
        this.api.listener.on('message', async (message: any) => {
          try {
            // Không phản hồi tin nhắn do chính tài khoản bot gửi ra
            if (message.uidFrom === this.ownId) {
              return;
            }

            const isGroup = Boolean(message.idTo && message.idTo !== this.ownId);
            const platformChatId = isGroup ? message.idTo : message.uidFrom;
            
            let text = '';
            if (typeof message.content === 'string') {
              text = message.content;
            } else if (message.content && typeof message.content === 'object') {
              text = (message.content as any).title || (message.content as any).msg || (message.content as any).description || '';
            }

            if (!text.trim()) {
              return;
            }

            if (this.config.onMessageReceived) {
              await this.config.onMessageReceived({
                platform: 'ZALO',
                accountId: this.accountId,
                platformChatId,
                senderId: message.uidFrom,
                senderName: message.dName || 'Zalo User',
                messageId: String(message.msgId || Date.now()),
                text,
                timestamp: Date.now(),
              });
            }
          } catch (handlerErr) {
            console.error('[ZaloAdapter] Error handling incoming message:', handlerErr);
          }
        });

        this.api.listener.start();
        console.log(`[ZaloAdapter] Zalo Message Listener started for account: ${this.accountId}`);
      } catch (err: any) {
        console.error(`[ZaloAdapter] Failed to start Zalo session for ${this.accountId}:`, err?.message || err);
        throw err;
      }
    } else {
      console.log(`[ZaloAdapter] OA_SECRET integration initialized.`);
    }
  }

  /**
   * Gửi tin nhắn trả lời về nhóm Zalo
   */
  async sendMessage(platformChatId: string, text: string): Promise<void> {
    if (!this.api) {
      console.warn(`[ZaloAdapter] Cannot send message: API instance is not initialized for ${this.accountId}`);
      return;
    }

    try {
      console.log(`[ZaloAdapter] Sending response to Zalo Thread ${platformChatId}: ${text.slice(0, 50)}...`);
      await this.api.sendMessage(text, platformChatId, ThreadType.Group);
    } catch (err: any) {
      console.error(`[ZaloAdapter] Failed to send message to Zalo Thread ${platformChatId}:`, err?.message || err);
    }
  }

  /**
   * Khởi tạo phiên quét mã QR thực sự từ Zalo Web
   */
  static async generateQrSession(): Promise<{ sessionId: string; qrDataUrl: string; status: QrSessionStatus }> {
    const sessionId = `zalo_qr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    const sessionState: ZaloQrSessionState = {
      sessionId,
      status: 'INITIALIZING',
      createdAt: Date.now(),
    };
    activeQrSessions.set(sessionId, sessionState);

    let capturedLoginInfo: any = null;

    // Chạy tiến trình Zalo loginQR trong nền
    const zalo = new Zalo({
      selfListen: false,
      checkUpdate: false,
      logging: false,
    });

    // Tạo promise để chờ khi mã QR được sinh ra
    const qrGeneratedPromise = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('QR Generation timed out after 15s'));
      }, 15000);

      zalo.loginQR({}, (event: any) => {
        try {
          if (event.type === LoginQRCallbackEventType.QRCodeGenerated) {
            clearTimeout(timeout);
            const rawImage = (event.data as any).image || '';
            const qrDataUrl = rawImage.startsWith('data:') 
              ? rawImage 
              : `data:image/png;base64,${rawImage}`;
            
            sessionState.status = 'GENERATED';
            sessionState.qrDataUrl = qrDataUrl;
            resolve(qrDataUrl);
          } else if (event.type === LoginQRCallbackEventType.QRCodeScanned) {
            sessionState.status = 'SCANNED';
            sessionState.user = {
              name: (event.data as any)?.display_name || 'Zalo User',
              avatar: (event.data as any)?.avatar || '',
            };
          } else if (event.type === LoginQRCallbackEventType.QRCodeExpired) {
            sessionState.status = 'EXPIRED';
            sessionState.error = 'Mã QR đã hết hạn. Vui lòng bấm tạo mã mới.';
          } else if (event.type === LoginQRCallbackEventType.QRCodeDeclined) {
            sessionState.status = 'DECLINED';
            sessionState.error = 'Đăng nhập bị từ chối trên thiết bị di động.';
          } else if (event.type === LoginQRCallbackEventType.GotLoginInfo) {
            capturedLoginInfo = event.data;
          }
        } catch (cbErr) {
          console.error('[ZaloAdapter] Error in QR callback:', cbErr);
        }
      })
      .then(async (apiResult: any) => {
        try {
          console.log('[ZaloAdapter] loginQR resolved successfully!');
          
          let accountName = sessionState.user?.name || 'Zalo Account';
          let avatar = sessionState.user?.avatar || '';
          let ownId = '';

          if (apiResult && typeof (apiResult as any).getOwnId === 'function') {
            ownId = (apiResult as any).getOwnId();
          }

          // Lấy thông tin credentials
          const credentials = {
            cookie: capturedLoginInfo?.cookie || (apiResult as any)?.cookies || [],
            imei: capturedLoginInfo?.imei || '',
            userAgent: capturedLoginInfo?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
          };

          const encryptedCredentials = encryptData(JSON.stringify(credentials));

          // Lưu hoặc cập nhật tài khoản vào PostgreSQL
          const account = await prisma.channelAccount.create({
            data: {
              platform: 'ZALO',
              accountName,
              authType: 'QR_SESSION',
              encryptedCredentials,
              status: 'ACTIVE',
              metadata: {
                zaloId: ownId,
                avatar,
                name: accountName,
              },
            },
          });

          sessionState.accountId = account.id;
          sessionState.status = 'COMPLETED';
          console.log(`[ZaloAdapter] Account created in PostgreSQL with ID: ${account.id} (${accountName})`);
        } catch (saveErr: any) {
          console.error('[ZaloAdapter] Error saving Zalo account after QR scan:', saveErr);
          sessionState.status = 'ERROR';
          sessionState.error = saveErr?.message || 'Lỗi khi lưu tài khoản vào cơ sở dữ liệu';
        }
      })
      .catch((loginErr: any) => {
        console.error('[ZaloAdapter] loginQR failed:', loginErr);
        sessionState.status = 'ERROR';
        sessionState.error = loginErr?.message || 'Đăng nhập Zalo thất bại';
      });
    });

    const qrDataUrl = await qrGeneratedPromise;

    return {
      sessionId,
      qrDataUrl,
      status: 'GENERATED',
    };
  }

  /**
   * Lấy trạng thái của phiên quét QR hiện tại
   */
  static getQrSessionStatus(sessionId: string): ZaloQrSessionState | null {
    return activeQrSessions.get(sessionId) || null;
  }
}
