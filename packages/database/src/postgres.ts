import { PrismaClient } from '@prisma/client';
import { ensureEnvLoaded } from './env.js';

ensureEnvLoaded();

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export function getPrismaClient(): PrismaClient {
  ensureEnvLoaded();
  if (global.prismaGlobal) {
    return global.prismaGlobal;
  }

  const client = new PrismaClient({
    datasources: process.env.DATABASE_URL
      ? {
          db: {
            url: process.env.DATABASE_URL,
          },
        }
      : undefined,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  if (process.env.NODE_ENV !== 'production') {
    global.prismaGlobal = client;
  }

  return client;
}

export const prisma = getPrismaClient();

export * from '@prisma/client';
