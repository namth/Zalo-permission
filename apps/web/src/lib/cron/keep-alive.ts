/**
 * Database Keep-Alive Service
 * 
 * Periodically pings Supabase (PostgreSQL) and Neo4j AuraDB
 * to prevent auto-pausing/hibernation on free tier accounts.
 */

import { query } from '../db/postgres';
import { executeQuery } from '../db/neo4j';
import { logger } from '../logger';

export interface PingResult {
  status: 'up' | 'down';
  latencyMs: number;
  error?: string;
}

export interface KeepAliveReport {
  timestamp: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  databases: {
    postgres: PingResult;
    neo4j: PingResult;
  };
}

let cronInterval: NodeJS.Timeout | null = null;
let isPinging = false;

/**
 * Ping both PostgreSQL and Neo4j
 */
export async function pingDatabases(): Promise<KeepAliveReport> {
  const report: KeepAliveReport = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    databases: {
      postgres: { status: 'down', latencyMs: 0 },
      neo4j: { status: 'down', latencyMs: 0 },
    },
  };

  // 1. Ping PostgreSQL (Supabase)
  const pgStart = Date.now();
  try {
    await query('SELECT 1 as keep_alive');
    report.databases.postgres = {
      status: 'up',
      latencyMs: Date.now() - pgStart,
    };
  } catch (error: any) {
    report.databases.postgres = {
      status: 'down',
      latencyMs: Date.now() - pgStart,
      error: error?.message || 'PostgreSQL ping failed',
    };
  }

  // 2. Ping Neo4j (AuraDB)
  const neo4jStart = Date.now();
  try {
    await executeQuery('RETURN 1 as keep_alive');
    report.databases.neo4j = {
      status: 'up',
      latencyMs: Date.now() - neo4jStart,
    };
  } catch (error: any) {
    report.databases.neo4j = {
      status: 'down',
      latencyMs: Date.now() - neo4jStart,
      error: error?.message || 'Neo4j ping failed',
    };
  }

  const pgUp = report.databases.postgres.status === 'up';
  const neo4jUp = report.databases.neo4j.status === 'up';

  if (pgUp && neo4jUp) {
    report.status = 'healthy';
  } else if (pgUp || neo4jUp) {
    report.status = 'degraded';
  } else {
    report.status = 'unhealthy';
  }

  return report;
}

/**
 * Start keep-alive cron job
 * @param intervalMinutes Frequency in minutes (default: 10 mins)
 */
export function startKeepAliveCron(intervalMinutes: number = 10): void {
  if (cronInterval) {
    logger.info('[Keep-Alive] Cron job already running');
    return;
  }

  const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;
  logger.info(`[Keep-Alive] Initializing background keep-alive job every ${intervalMinutes} minutes`);

  const runPing = async () => {
    if (isPinging) {
      logger.warn('[Keep-Alive] Previous ping still in progress, skipping iteration');
      return;
    }
    isPinging = true;
    try {
      const report = await pingDatabases();
      if (report.status === 'healthy') {
        logger.info(
          `[Keep-Alive] Ping OK: Postgres (${report.databases.postgres.latencyMs}ms), Neo4j (${report.databases.neo4j.latencyMs}ms)`
        );
      } else {
        logger.warn(
          `[Keep-Alive] Status: ${report.status} | Postgres: ${report.databases.postgres.status} (${report.databases.postgres.error || 'ok'}) | Neo4j: ${report.databases.neo4j.status} (${report.databases.neo4j.error || 'ok'})`
        );
      }
    } catch (err: any) {
      logger.error('[Keep-Alive] Unexpected error during keep-alive execution:', err);
    } finally {
      isPinging = false;
    }
  };

  // Run initial warm-up ping after 5 seconds
  setTimeout(runPing, 5000);

  // Set recurring timer
  cronInterval = setInterval(runPing, intervalMs);
}

/**
 * Stop keep-alive cron job
 */
export function stopKeepAliveCron(): void {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    logger.info('[Keep-Alive] Cron job stopped');
  }
}
