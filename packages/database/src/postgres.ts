import { PrismaClient } from '@prisma/client';
import { ensureEnvLoaded } from './env.js';

ensureEnvLoaded();

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export function getPrismaClient(): PrismaClient {
  ensureEnvLoaded();
  const globalRef = (globalThis as any);
  if (globalRef.prismaGlobal) {
    return globalRef.prismaGlobal;
  }

  let dbUrl = process.env.DATABASE_URL;
  if (dbUrl && !dbUrl.includes('connection_limit=')) {
    const separator = dbUrl.includes('?') ? '&' : '?';
    dbUrl = `${dbUrl}${separator}connection_limit=3&pool_timeout=15`;
  }

  const client = new PrismaClient({
    datasources: dbUrl
      ? {
          db: {
            url: dbUrl,
          },
        }
      : undefined,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  globalRef.prismaGlobal = client;
  return client;
}

export const prisma = getPrismaClient();

export * from '@prisma/client';
