/**
 * Standalone Keep-Alive Script
 * 
 * Can be run via ts-node, crontab, or scheduled CI/CD job:
 * npx ts-node -r dotenv/config scripts/keep-alive.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env and .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { pingDatabases } from '../src/lib/cron/keep-alive';
import { closeDb } from '../src/lib/db/postgres';
import { closeNeo4j } from '../src/lib/db/neo4j';

async function main() {
  console.log(`[${new Date().toISOString()}] Executing Keep-Alive check for Supabase & Neo4j...`);
  try {
    const report = await pingDatabases();
    console.log(JSON.stringify(report, null, 2));

    if (report.status === 'unhealthy') {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('Keep-alive script failed with error:', error);
    process.exitCode = 1;
  } finally {
    await closeDb();
    await closeNeo4j();
  }
}

main();
