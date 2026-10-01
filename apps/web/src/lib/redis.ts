import { Redis } from 'ioredis';

declare global {
  // eslint-disable-next-line no-var
  var globalRedisClient: Redis | undefined;
}

export function getRedisClient(): Redis {
  if (global.globalRedisClient) {
    return global.globalRedisClient;
  }

  const host = process.env.REDIS_HOST || 'localhost';
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);
  const password = process.env.REDIS_PASSWORD || undefined;

  const client = new Redis({
    host,
    port,
    password,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  client.on('error', (err) => {
    console.error('[Web Redis] Connection error:', err);
  });

  if (process.env.NODE_ENV !== 'production') {
    global.globalRedisClient = client;
  }

  return client;
}

export const INBOUND_STREAM = process.env.REDIS_STREAM_INBOUND || 'stream:inbound_messages';
