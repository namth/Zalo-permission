import { Redis } from 'ioredis';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (redisClient) {
    return redisClient;
  }

  const host = process.env.REDIS_HOST || 'localhost';
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);
  const password = process.env.REDIS_PASSWORD || undefined;

  redisClient = new Redis({
    host,
    port,
    password,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  redisClient.on('connect', () => {
    console.log('[Redis] Connected successfully to Redis server');
  });

  redisClient.on('error', (err) => {
    console.error('[Redis] Connection error:', err);
  });

  return redisClient;
}

export const INBOUND_STREAM = process.env.REDIS_STREAM_INBOUND || 'stream:inbound_messages';
export const OUTBOUND_STREAM = process.env.REDIS_STREAM_OUTBOUND || 'stream:outbound_messages';
export const CONSUMER_GROUP = 'omniagent_workers';

/**
 * Đảm bảo Consumer Group tồn tại trên Redis Stream
 */
export async function initStreamGroup(redis: Redis, streamName: string, groupName: string): Promise<void> {
  try {
    await redis.xgroup('CREATE', streamName, groupName, '$', 'MKSTREAM');
    console.log(`[Redis] Created consumer group ${groupName} on ${streamName}`);
  } catch (err: unknown) {
    // BUSYGROUP Consumer Group already exists
    if (err instanceof Error && err.message.includes('BUSYGROUP')) {
      // Group already exists, ignore
    } else {
      console.warn(`[Redis] Notice on xgroup create:`, err);
    }
  }
}
