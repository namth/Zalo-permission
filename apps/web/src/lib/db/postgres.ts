import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

let pool: Pool | null = null;

function ensureEnvLoaded() {
  if (!process.env.DATABASE_URL) {
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
    dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
    dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
    dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
    dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
  }
}

/**
 * Initialize PostgreSQL connection pool
 */
export function initDb(): Pool {
  if (pool) return pool;

  ensureEnvLoaded();
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
  });

  // Handle unexpected errors on idle clients to prevent crashing the Node.js process
  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err?.message || err);
  });

  // Self-heal: ensure user_profile table exists
  pool.query(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      zalo_id VARCHAR(255) UNIQUE,
      username VARCHAR(255) UNIQUE,
      password_hash TEXT,
      full_name VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(20),
      gender VARCHAR(20),
      note TEXT,
      role VARCHAR(50) DEFAULT 'user',
      status VARCHAR(50) DEFAULT 'active',
      api_token VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `).catch((err) => {
    console.error('Failed to auto-ensure user_profile table:', err.message);
  });

  // Self-heal: ensure workspaces table exists and schema matches requirements
  pool.query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    CREATE TABLE IF NOT EXISTS workspaces (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE,
      description TEXT,
      status VARCHAR(50) DEFAULT 'active',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
    ALTER TABLE workspaces ALTER COLUMN slug DROP NOT NULL;
    ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
    ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'isActive') THEN
        ALTER TABLE workspaces RENAME COLUMN "isActive" TO is_active;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'createdAt') THEN
        ALTER TABLE workspaces RENAME COLUMN "createdAt" TO created_at;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'updatedAt') THEN
        ALTER TABLE workspaces RENAME COLUMN "updatedAt" TO updated_at;
      END IF;
    END $$;
  `).catch((err) => {
    console.error('Failed to auto-ensure workspaces table schema:', err.message);
  });

  return pool;
}

/**
 * Get database pool instance
 */
export function getDb(): Pool {
  if (!pool) {
    return initDb();
  }
  return pool;
}

/**
 * Get a single client connection
 */
export async function getDbClient(): Promise<PoolClient> {
  const dbPool = getDb();
  return dbPool.connect();
}

/**
 * Execute a query
 */
export async function query(text: string, params: any[] = []) {
  const dbPool = getDb();
  return dbPool.query(text, params);
}

/**
 * Execute a transaction
 */
export async function transaction(callback: (client: PoolClient) => Promise<any>) {
  const client = await getDbClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Test database connection
 */
export async function testDbConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT 1');
    return result.rows.length > 0;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

/**
 * Close database connections
 */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
