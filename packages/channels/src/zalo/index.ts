import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { Zalo, ThreadType, LoginQRCallbackEventType, type API, type Credentials } from 'zca-js';
import { prisma, encryptData, decryptData } from '@omniagent/database';
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

/**
 * Tải ảnh từ URL về file tạm trên ổ đĩa để zca-js upload làm attachment
 */
async function downloadImageToTempFile(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      console.warn(`[ZaloAdapter] Failed to fetch image ${url}: status ${res.status}`);
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let ext = '.png';
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg';
    else if (contentType.includes('webp')) ext = '.webp';
    else if (contentType.includes('gif')) ext = '.gif';
    else if (url.includes('.jpg') || url.includes('.jpeg')) ext = '.jpg';
    else if (url.includes('.webp')) ext = '.webp';

    const hash = crypto.randomBytes(8).toString('hex');
    const tempPath = path.join(os.tmpdir(), `zalo_media_${Date.now()}_${hash}${ext}`);
    await fs.promises.writeFile(tempPath, buffer);
    return tempPath;
  } catch (err) {
    console.warn(`[ZaloAdapter] Error downloading image from ${url}:`, err);
    return null;
  }
}

/**
 * Trích xuất kích thước ảnh (width, height) thuần Buffer từ header của PNG, JPEG, GIF, WEBP
 */
function getImageDimensions(buffer: Buffer): { width: number; height: number } {
  // PNG
  if (buffer.length >= 24 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  // GIF
  if (buffer.length >= 10 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  // JPEG
  if (buffer.length >= 4 && buffer[0] === 0xFF && buffer[1] === 0xD8) {
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xFF) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      if (marker >= 0xC0 && marker <= 0xC3 && marker !== 0xC4) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      const len = buffer.readUInt16BE(offset + 2);
      offset += 2 + len;
    }
  }
  // WEBP
  if (buffer.length >= 30 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    const chunkType = buffer.toString('ascii', 12, 16);
    if (chunkType === 'VP8 ') {
      return {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff,
      };
    } else if (chunkType === 'VP8L') {
      const b0 = buffer[21], b1 = buffer[22], b2 = buffer[23], b3 = buffer[24];
      const width = 1 + (((b1 & 0x3f) << 8) | b0);
      const height = 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      return { width, height };
    } else if (chunkType === 'VP8X') {
      const width = 1 + buffer.readUIntLE(24, 3);
      const height = 1 + buffer.readUIntLE(27, 3);
      return { width, height };
    }
  }
  return { width: 800, height: 800 };
}

/**
 * Hàm cung cấp metadata ảnh cho zca-js theo yêu cầu từ phiên bản v2.0.0+
 */
async function customImageMetadataGetter(filePath: string): Promise<{ width: number; height: number; size: number }> {
  try {
    const stat = await fs.promises.stat(filePath);
    const buffer = await fs.promises.readFile(filePath);
    const dims = getImageDimensions(buffer);
    return {
      width: dims.width || 800,
      height: dims.height || 800,
      size: stat.size,
    };
  } catch {
    return {
      width: 800,
      height: 800,
      size: 1024,
    };
  }
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
          imageMetadataGetter: customImageMetadataGetter,
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
            const data = message?.data || message;

            // Không phản hồi tin nhắn do chính tài khoản bot gửi ra
            if (message?.isSelf || data?.uidFrom === this.ownId || data?.uidFrom === '0') {
              return;
            }

            const isGroup = message?.type === ThreadType.Group || Boolean(message?.threadId && data?.idTo && data.idTo !== this.ownId);
            const platformChatId = String(message?.threadId || data?.idTo || data?.uidFrom || '');
            const senderId = String(data?.uidFrom || '');
            const senderName = String(data?.dName || message?.dName || 'Zalo User');

            let text = '';
            if (typeof data?.content === 'string') {
              text = data.content;
            } else if (data?.content && typeof data.content === 'object') {
              text = (data.content as any).title || (data.content as any).msg || (data.content as any).description || '';
            } else if (typeof message?.content === 'string') {
              text = message.content;
            }

            // Bóc tách Tin Nhắn Được Tag / Trích Dẫn (Quote)
            let quotedMessage: any = undefined;
            const rawQuote = data?.quote || data?.content?.quote || data?.propertyExt?.quote || message?.quote;
            if (rawQuote) {
              const quoteText = rawQuote.msg || rawQuote.content || rawQuote.title || (typeof rawQuote === 'string' ? rawQuote : '');
              if (quoteText) {
                quotedMessage = {
                  messageId: String(rawQuote.cliMsgId || rawQuote.globalMsgId || rawQuote.id || ''),
                  senderId: String(rawQuote.ownerId || rawQuote.uidFrom || ''),
                  senderName: String(rawQuote.dName || 'Thành viên nhóm'),
                  text: String(quoteText),
                  mediaUrl: rawQuote.attach ? String(rawQuote.attach) : undefined,
                };
              }
            }

            // Bóc tách Hình Ảnh (Bill, Hóa đơn, Ảnh chụp màn hình)
            const mediaUrls: string[] = [];
            const msgType = String(data?.msgType || message?.msgType || '');
            if (msgType.includes('photo') || msgType.includes('image')) {
              const photoUrl = data?.content?.href || data?.content?.url || data?.content?.thumb || data?.params?.url;
              if (photoUrl) mediaUrls.push(String(photoUrl));
            }
            if (data?.content && typeof data.content === 'object' && data.content.href) {
              if (!mediaUrls.includes(data.content.href)) {
                mediaUrls.push(data.content.href);
              }
            }

            if (!text.trim() && mediaUrls.length > 0) {
              text = '[Hình ảnh đính kèm]';
            }

            if (!text.trim() || !platformChatId) {
              return;
            }

            console.log(`[ZaloAdapter] Inbound message received from chat ${platformChatId} (${isGroup ? 'Group' : 'Direct'}) by ${senderName}: "${text.slice(0, 60)}"`);
            if (quotedMessage) {
              console.log(`[ZaloAdapter] ↳ Quoted Tag from ${quotedMessage.senderName}: "${quotedMessage.text.slice(0, 50)}"`);
            }
            if (mediaUrls.length > 0) {
              console.log(`[ZaloAdapter] ↳ Media Attachments (${mediaUrls.length}):`, mediaUrls);
            }

            if (this.config.onMessageReceived) {
              await this.config.onMessageReceived({
                platform: 'ZALO',
                accountId: this.accountId,
                platformChatId,
                senderId,
                senderName,
                messageId: String(data?.msgId || message?.msgId || Date.now()),
                text,
                isGroup,
                quotedMessage,
                mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
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
   * Gửi tin nhắn trả lời về nhóm Zalo hoặc Direct Chat
   * Hỗ trợ gửi ảnh đính kèm (VietQR, hóa đơn) và tách thành các câu ngắn gửi lần lượt cách nhau 1s
   */
  async sendMessage(
    platformChatId: string, 
    messages: string | string[], 
    chatType: ThreadType = ThreadType.Group,
    mediaUrls?: string[]
  ): Promise<void> {
    if (!this.api) {
      console.warn(`[ZaloAdapter] Cannot send message: API instance is not initialized for ${this.accountId}`);
      return;
    }

    const messageList = Array.isArray(messages) ? messages : [messages];
    const tempFiles: string[] = [];

    try {
      // 1. Tải ảnh về file tạm nếu có link media (loại trừ link trùng lặp)
      if (mediaUrls && mediaUrls.length > 0) {
        const uniqueUrls = Array.from(new Set(mediaUrls.map((u) => u.trim()).filter(Boolean)));
        for (const url of uniqueUrls) {
          const tempPath = await downloadImageToTempFile(url);
          if (tempPath) tempFiles.push(tempPath);
        }
      }

      // 2. Gửi ảnh đính kèm trước (nếu có)
      if (tempFiles.length > 0) {
        console.log(`[ZaloAdapter] Sending ${tempFiles.length} photo attachment(s) to Zalo Thread ${platformChatId}...`);
        await this.api.sendMessage(
          {
            msg: '',
            attachments: tempFiles,
          },
          platformChatId,
          chatType
        );
      }

      // 3. Gửi lần lượt từng câu ngắn cách nhau 1 khoảng thời gian (~1000ms)
      for (let i = 0; i < messageList.length; i++) {
        const sentence = messageList[i]?.trim();
        if (!sentence) continue;

        // Nếu đã có ảnh gửi trước hoặc là câu thứ 2 trở đi -> chờ 1s
        if (tempFiles.length > 0 || i > 0) {
          await new Promise((res) => setTimeout(res, 1000));
        }

        console.log(`[ZaloAdapter] Sending sentence (${i + 1}/${messageList.length}) to Zalo Thread ${platformChatId}: "${sentence.slice(0, 50)}..."`);
        await this.api.sendMessage(sentence, platformChatId, chatType);
      }
    } catch (err: any) {
      console.error(`[ZaloAdapter] Failed to send message to Zalo Thread ${platformChatId}:`, err?.message || err);
    } finally {
      // Dọn dẹp file tạm sau khi gửi xong
      for (const f of tempFiles) {
        fs.promises.unlink(f).catch(() => {});
      }
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
          
          let accountName = sessionState.user?.name || apiResult?.userInfo?.name || 'Zalo Account';
          let avatar = sessionState.user?.avatar || apiResult?.userInfo?.avatar || '';
          let ownId = '';

          try {
            if (apiResult && typeof (apiResult as any).getOwnId === 'function') {
              ownId = (apiResult as any).getOwnId();
            } else if (apiResult?.userInfo?.userId) {
              ownId = String(apiResult.userInfo.userId);
            } else if (apiResult?.userInfo?.uid) {
              ownId = String(apiResult.userInfo.uid);
            } else if (apiResult?.userInfo?.id) {
              ownId = String(apiResult.userInfo.id);
            } else if (capturedLoginInfo?.userId || capturedLoginInfo?.uid) {
              ownId = String(capturedLoginInfo.userId || capturedLoginInfo.uid);
            }
          } catch (idErr) {
            console.warn('[ZaloAdapter] Could not determine ownId:', idErr);
          }

          // Thử lấy thêm thông tin nếu tên còn chung chung
          if ((!accountName || accountName === 'Zalo Account' || accountName === 'Zalo User') && ownId && typeof (apiResult as any)?.getUserInfo === 'function') {
            try {
              const uInfo = await (apiResult as any).getUserInfo(ownId);
              const data = (uInfo as any)?.data || uInfo;
              if (data?.display_name || data?.name) {
                accountName = data.display_name || data.name;
              }
              if (data?.avatar) {
                avatar = data.avatar;
              }
            } catch (uErr) {
              console.warn('[ZaloAdapter] getUserInfo notice:', uErr);
            }
          }

          // Lấy thông tin credentials
          const rawCookies = capturedLoginInfo?.cookie 
            || (apiResult as any)?.cookies 
            || (apiResult as any)?.ctx?.cookie?.toJSON?.()?.cookies
            || [];
          const rawImei = capturedLoginInfo?.imei 
            || (apiResult as any)?.ctx?.imei 
            || (apiResult as any)?.imei 
            || '';
          const rawUserAgent = capturedLoginInfo?.userAgent 
            || (apiResult as any)?.ctx?.userAgent 
            || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0';

          const credentials = {
            cookie: rawCookies,
            imei: rawImei,
            userAgent: rawUserAgent,
          };

          const encryptedCredentials = encryptData(JSON.stringify(credentials));

          // Tự động đảm bảo bảng channel_accounts tồn tại
          try {
            await prisma.$executeRawUnsafe(`
              CREATE TABLE IF NOT EXISTS channel_accounts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                platform VARCHAR(50) DEFAULT 'ZALO',
                account_name VARCHAR(255) NOT NULL,
                auth_type VARCHAR(50) DEFAULT 'QR_SESSION',
                encrypted_credentials TEXT NOT NULL,
                status VARCHAR(50) DEFAULT 'ACTIVE',
                metadata JSONB DEFAULT '{}',
                last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `);
          } catch (tableErr: any) {
            console.warn('[ZaloAdapter] Notice ensuring channel_accounts table:', tableErr?.message);
          }

          // Kiểm tra xem tài khoản Zalo này đã từng được lưu hay chưa
          const existingAccounts = await prisma.channelAccount.findMany({
            where: { platform: 'ZALO' },
          });

          const existing = existingAccounts.find((a: any) => {
            const meta = a.metadata as any;
            if (ownId && meta?.zaloId === ownId) return true;
            if (accountName && a.accountName === accountName) return true;
            return false;
          });

          let account;
          if (existing) {
            account = await prisma.channelAccount.update({
              where: { id: existing.id },
              data: {
                accountName,
                authType: 'QR_SESSION',
                encryptedCredentials,
                status: 'ACTIVE',
                lastSyncedAt: new Date(),
                metadata: {
                  zaloId: ownId || (existing.metadata as any)?.zaloId || '',
                  avatar: avatar || (existing.metadata as any)?.avatar || '',
                  name: accountName,
                },
              },
            });
            console.log(`[ZaloAdapter] Existing account updated: ${account.id} (${accountName})`);
          } else {
            account = await prisma.channelAccount.create({
              data: {
                platform: 'ZALO',
                accountName,
                authType: 'QR_SESSION',
                encryptedCredentials,
                status: 'ACTIVE',
                lastSyncedAt: new Date(),
                metadata: {
                  zaloId: ownId,
                  avatar,
                  name: accountName,
                },
              },
            });
            console.log(`[ZaloAdapter] Account created in PostgreSQL with ID: ${account.id} (${accountName})`);
          }

          sessionState.accountId = account.id;
          sessionState.status = 'COMPLETED';
          console.log(`[ZaloAdapter] QR login finished successfully for account: ${account.id}`);
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

export interface DiscoveredZaloGroup {
  groupId: string;
  name: string;
  avatar?: string;
  totalMember?: number;
}

/**
 * Đăng nhập bằng credentials đã lưu và quét toàn bộ danh bạ nhóm chat Zalo của tài khoản
 */
export async function discoverZaloGroups(encryptedCredentials: string): Promise<DiscoveredZaloGroup[]> {
  let credentials: Credentials;
  try {
    const decryptedStr = decryptData(encryptedCredentials);
    credentials = JSON.parse(decryptedStr);
  } catch (err: any) {
    throw new Error('Không thể giải mã thông tin đăng nhập Zalo: ' + err.message);
  }

  if (!credentials || !credentials.cookie || !credentials.imei) {
    throw new Error('Thông tin đăng nhập Zalo không hợp lệ hoặc thiếu cookie/imei');
  }

  const zalo = new Zalo({
    selfListen: false,
    checkUpdate: false,
    logging: false,
  });

  const api = await zalo.login(credentials);
  const groupsRes = await api.getAllGroups();
  const groupIds = Object.keys(groupsRes.gridVerMap || {});

  if (groupIds.length === 0) {
    return [];
  }

  const results: DiscoveredZaloGroup[] = [];
  const chunkSize = 50;
  for (let i = 0; i < groupIds.length; i += chunkSize) {
    const chunk = groupIds.slice(i, i + chunkSize);
    try {
      const infoRes = await api.getGroupInfo(chunk);
      if (infoRes && infoRes.gridInfoMap) {
        for (const [gid, ginfo] of Object.entries(infoRes.gridInfoMap)) {
          results.push({
            groupId: gid,
            name: (ginfo as any).name || `Nhóm Zalo (${gid})`,
            avatar: (ginfo as any).avt || undefined,
            totalMember: (ginfo as any).totalMember || (Array.isArray((ginfo as any).memberIds) ? (ginfo as any).memberIds.length : 0),
          });
        }
      } else {
        for (const gid of chunk) {
          results.push({ groupId: gid, name: `Nhóm Zalo (${gid})` });
        }
      }
    } catch (e) {
      console.warn('[Zalo discoverGroups] error fetching chunk info:', e);
      for (const gid of chunk) {
        results.push({ groupId: gid, name: `Nhóm Zalo (${gid})` });
      }
    }
  }

  return results;
}

