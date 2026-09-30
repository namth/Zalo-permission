import type { Redis } from 'ioredis';

export interface ChatSessionState {
  isWarm: boolean;
  lastActiveUserId?: string;
  lastActiveUserName?: string;
  lastActiveTimestamp?: number;
}

const SESSION_TTL_SECONDS = 600; // 10 phút

/**
 * Kiểm tra xem tin nhắn có mention hoặc gọi đích danh Agent Thảo Chi không
 */
export function checkMention(text: string, additionalKeywords: string[] = []): boolean {
  if (!text) return false;

  const normalized = text.toLowerCase().trim();

  // Pattern nhận diện các cách gọi thân mật tự nhiên của người Việt
  const defaultPatterns = [
    /@thảo\s*chi/i,
    /@thao\s*chi/i,
    /@bot\b/i,
    /\bthảo\s*chi\b/i,
    /\bthao\s*chi\b/i,
    /\bchi\s+ơi\b/i,
    /\bchi\s+à\b/i,
    /\bchi\s+nè\b/i,
    /\bem\s+chi\b/i,
    /\bbé\s+chi\b/i,
    /\bchi\s+giúp\b/i,
    /\bchi\s+hộ\b/i,
    /\bchi\s+check\b/i,
    /\bchi\s+xem\b/i,
  ];

  for (const pattern of defaultPatterns) {
    if (pattern.test(normalized)) {
      return true;
    }
  }

  for (const kw of additionalKeywords) {
    if (kw && normalized.includes(kw.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Lấy trạng thái phiên hội thoại (COLD vs WARM) của nhóm chat từ Redis
 */
export async function getChatSession(
  redis: Redis,
  platform: string,
  platformChatId: string
): Promise<ChatSessionState> {
  const sessionKey = `agent:chat_session:${platform}:${platformChatId}`;
  try {
    const raw = await redis.get(sessionKey);
    if (!raw) {
      return { isWarm: false };
    }
    const parsed = JSON.parse(raw);
    return {
      isWarm: true,
      lastActiveUserId: parsed.userId,
      lastActiveUserName: parsed.userName,
      lastActiveTimestamp: parsed.timestamp,
    };
  } catch (err) {
    console.warn(`[ChatSession] Failed to get session for ${sessionKey}:`, err);
    return { isWarm: false };
  }
}

/**
 * Kích hoạt hoặc gia hạn trạng thái WARM cho nhóm chat với TTL = 10 phút
 */
export async function refreshWarmSession(
  redis: Redis,
  platform: string,
  platformChatId: string,
  userId?: string,
  userName?: string,
  ttlSeconds: number = SESSION_TTL_SECONDS
): Promise<void> {
  const sessionKey = `agent:chat_session:${platform}:${platformChatId}`;
  try {
    const payload = JSON.stringify({
      state: 'WARM',
      userId,
      userName,
      timestamp: Date.now(),
    });
    await redis.set(sessionKey, payload, 'EX', ttlSeconds);
    console.log(`[ChatSession] ⚡ WARM session active for ${platform}:${platformChatId} (TTL: ${ttlSeconds}s) by ${userName || userId}`);
  } catch (err) {
    console.warn(`[ChatSession] Failed to refresh warm session for ${sessionKey}:`, err);
  }
}

/**
 * Chuyển trạng thái chat về COLD ngay lập tức
 */
export async function setColdSession(
  redis: Redis,
  platform: string,
  platformChatId: string
): Promise<void> {
  const sessionKey = `agent:chat_session:${platform}:${platformChatId}`;
  try {
    await redis.del(sessionKey);
    console.log(`[ChatSession] ❄️ Reset to COLD state for ${platform}:${platformChatId}`);
  } catch (err) {
    console.warn(`[ChatSession] Failed to set cold session for ${sessionKey}:`, err);
  }
}
