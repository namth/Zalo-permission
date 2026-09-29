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

  // Self-heal: ensure all tables and schemas match application requirements
  ensureWorkspacesSchema(pool).catch((err) => {
    console.error('Failed to auto-ensure database schema:', err.message);
  });

  return pool;
}

/**
 * Ensure all tables have required columns and drop legacy conflicting camelCase constraints
 */
export async function ensureWorkspacesSchema(dbPool?: Pool): Promise<void> {
  const db = dbPool || getDb();
  const steps = [
    // 1. WORKSPACES
    `CREATE TABLE IF NOT EXISTS workspaces (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255),
      description TEXT,
      status VARCHAR(50) DEFAULT 'active',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active'`,
    `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS slug VARCHAR(255)`,
    `ALTER TABLE workspaces ALTER COLUMN slug DROP NOT NULL`,
    `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`,
    `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`,
    `DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'updatedAt') THEN
        ALTER TABLE workspaces ALTER COLUMN "updatedAt" DROP NOT NULL;
        UPDATE workspaces SET updated_at = "updatedAt" WHERE updated_at IS NULL;
        ALTER TABLE workspaces DROP COLUMN "updatedAt";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'createdAt') THEN
        ALTER TABLE workspaces ALTER COLUMN "createdAt" DROP NOT NULL;
        UPDATE workspaces SET created_at = "createdAt" WHERE created_at IS NULL;
        ALTER TABLE workspaces DROP COLUMN "createdAt";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'isActive') THEN
        ALTER TABLE workspaces ALTER COLUMN "isActive" DROP NOT NULL;
        UPDATE workspaces SET is_active = "isActive" WHERE is_active IS NULL;
        ALTER TABLE workspaces DROP COLUMN "isActive";
      END IF;
    END $$;`,

    // 2. USER_PROFILE
    `ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS username VARCHAR(255)`,
    `ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS password_hash TEXT`,
    `ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user'`,
    `ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active'`,
    `ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS api_token VARCHAR(255)`,
    `DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profile' AND column_name = 'updatedAt') THEN
        ALTER TABLE user_profile ALTER COLUMN "updatedAt" DROP NOT NULL;
        UPDATE user_profile SET updated_at = "updatedAt" WHERE updated_at IS NULL;
        ALTER TABLE user_profile DROP COLUMN "updatedAt";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profile' AND column_name = 'createdAt') THEN
        ALTER TABLE user_profile ALTER COLUMN "createdAt" DROP NOT NULL;
        UPDATE user_profile SET created_at = "createdAt" WHERE created_at IS NULL;
        ALTER TABLE user_profile DROP COLUMN "createdAt";
      END IF;
    END $$;`,

    // 3. ZALO_GROUPS
    `CREATE TABLE IF NOT EXISTS zalo_groups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID,
      thread_id VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255),
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,

    // 4. WORKSPACE_USER_ROLES
    `CREATE TABLE IF NOT EXISTS workspace_user_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL,
      user_id UUID NOT NULL,
      role VARCHAR(50) NOT NULL,
      assigned_by UUID,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(workspace_id, user_id)
    )`,

    // 5. TOOL_GROUPS
    `CREATE TABLE IF NOT EXISTS tool_groups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      base_url VARCHAR(500),
      status VARCHAR(50) DEFAULT 'active',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE tool_groups ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active'`,
    `ALTER TABLE tool_groups ADD COLUMN IF NOT EXISTS base_url VARCHAR(500)`,
    `ALTER TABLE tool_groups ADD COLUMN IF NOT EXISTS protocol_type VARCHAR(50) DEFAULT 'REST'`,
    `ALTER TABLE tool_groups ADD COLUMN IF NOT EXISTS mcp_transport VARCHAR(50) DEFAULT 'SSE'`,
    `ALTER TABLE tool_groups ADD COLUMN IF NOT EXISTS mcp_raw_config JSONB`,
    `ALTER TABLE tool_groups ADD COLUMN IF NOT EXISTS timeout_seconds INT DEFAULT 15`,
    `ALTER TABLE tool_groups ADD COLUMN IF NOT EXISTS default_auth_config JSONB DEFAULT '{}'`,
    `ALTER TABLE tool_groups ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`,
    `ALTER TABLE tool_groups ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE tool_groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`,
    `DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tool_groups' AND column_name = 'baseUrl') THEN
        ALTER TABLE tool_groups ALTER COLUMN "baseUrl" DROP NOT NULL;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tool_groups' AND column_name = 'updatedAt') THEN
        ALTER TABLE tool_groups ALTER COLUMN "updatedAt" DROP NOT NULL;
        UPDATE tool_groups SET updated_at = "updatedAt" WHERE updated_at IS NULL;
        ALTER TABLE tool_groups DROP COLUMN "updatedAt";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tool_groups' AND column_name = 'createdAt') THEN
        ALTER TABLE tool_groups ALTER COLUMN "createdAt" DROP NOT NULL;
        UPDATE tool_groups SET created_at = "createdAt" WHERE created_at IS NULL;
        ALTER TABLE tool_groups DROP COLUMN "createdAt";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tool_groups' AND column_name = 'isActive') THEN
        ALTER TABLE tool_groups ALTER COLUMN "isActive" DROP NOT NULL;
        UPDATE tool_groups SET is_active = "isActive" WHERE is_active IS NULL;
        ALTER TABLE tool_groups DROP COLUMN "isActive";
      END IF;
    END $$;`,

    // 6. TOOLS
    `CREATE TABLE IF NOT EXISTS tools (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      input_schema JSONB,
      output_schema JSONB,
      embedding JSONB,
      status VARCHAR(50) DEFAULT 'active',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE tools ADD COLUMN IF NOT EXISTS tool_group_id UUID REFERENCES tool_groups(id) ON DELETE CASCADE`,
    `ALTER TABLE tools ADD COLUMN IF NOT EXISTS method VARCHAR(20) DEFAULT 'POST'`,
    `ALTER TABLE tools ADD COLUMN IF NOT EXISTS path VARCHAR(500)`,
    `ALTER TABLE tools ADD COLUMN IF NOT EXISTS parameters_schema JSONB`,
    `ALTER TABLE tools ADD COLUMN IF NOT EXISTS input_schema JSONB`,
    `ALTER TABLE tools ADD COLUMN IF NOT EXISTS output_schema JSONB`,
    `ALTER TABLE tools ADD COLUMN IF NOT EXISTS embedding JSONB`,
    `ALTER TABLE tools ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active'`,
    `ALTER TABLE tools ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`,
    `ALTER TABLE tools ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE tools ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`,
    `DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tools' AND column_name = 'toolGroupId') THEN
        ALTER TABLE tools ALTER COLUMN "toolGroupId" DROP NOT NULL;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tools' AND column_name = 'path') THEN
        ALTER TABLE tools ALTER COLUMN "path" DROP NOT NULL;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tools' AND column_name = 'updatedAt') THEN
        ALTER TABLE tools ALTER COLUMN "updatedAt" DROP NOT NULL;
        UPDATE tools SET updated_at = "updatedAt" WHERE updated_at IS NULL;
        ALTER TABLE tools DROP COLUMN "updatedAt";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tools' AND column_name = 'createdAt') THEN
        ALTER TABLE tools ALTER COLUMN "createdAt" DROP NOT NULL;
        UPDATE tools SET created_at = "createdAt" WHERE created_at IS NULL;
        ALTER TABLE tools DROP COLUMN "createdAt";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tools' AND column_name = 'isActive') THEN
        ALTER TABLE tools ALTER COLUMN "isActive" DROP NOT NULL;
        UPDATE tools SET is_active = "isActive" WHERE is_active IS NULL;
        ALTER TABLE tools DROP COLUMN "isActive";
      END IF;
    END $$;`,

    // 7. SKILLS
    `CREATE TABLE IF NOT EXISTS skills (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key VARCHAR(100) UNIQUE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      detail TEXT,
      is_shared BOOLEAN DEFAULT false,
      embedding JSONB,
      status VARCHAR(50) DEFAULT 'active',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE skills ADD COLUMN IF NOT EXISTS detail TEXT`,
    `ALTER TABLE skills ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false`,
    `ALTER TABLE skills ADD COLUMN IF NOT EXISTS embedding JSONB`,
    `ALTER TABLE skills ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active'`,
    `ALTER TABLE skills ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`,
    `ALTER TABLE skills ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE skills ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`,
    `DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'skills' AND column_name = 'key') THEN
        ALTER TABLE skills ALTER COLUMN "key" DROP NOT NULL;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'skills' AND column_name = 'systemPrompt') THEN
        ALTER TABLE skills ALTER COLUMN "systemPrompt" DROP NOT NULL;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'skills' AND column_name = 'updatedAt') THEN
        ALTER TABLE skills ALTER COLUMN "updatedAt" DROP NOT NULL;
        UPDATE skills SET updated_at = "updatedAt" WHERE updated_at IS NULL;
        ALTER TABLE skills DROP COLUMN "updatedAt";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'skills' AND column_name = 'createdAt') THEN
        ALTER TABLE skills ALTER COLUMN "createdAt" DROP NOT NULL;
        UPDATE skills SET created_at = "createdAt" WHERE created_at IS NULL;
        ALTER TABLE skills DROP COLUMN "createdAt";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'skills' AND column_name = 'isActive') THEN
        ALTER TABLE skills ALTER COLUMN "isActive" DROP NOT NULL;
        UPDATE skills SET is_active = "isActive" WHERE is_active IS NULL;
        ALTER TABLE skills DROP COLUMN "isActive";
      END IF;
    END $$;`,

    // 8. PENDING_TASKS
    `CREATE TABLE IF NOT EXISTS pending_tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL,
      thread_id VARCHAR(255) NOT NULL,
      user_id VARCHAR(255),
      intent VARCHAR(255),
      full_plan JSONB,
      missing_parameters JSONB,
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,

    // 9. AUDIT_LOGS
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID,
      thread_id VARCHAR(255),
      user_id VARCHAR(255),
      action_type VARCHAR(100),
      input_data JSONB,
      output_data JSONB,
      status VARCHAR(50) DEFAULT 'success',
      error_message TEXT,
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS workspace_id UUID`,
    `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS thread_id VARCHAR(255)`,
    `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_id VARCHAR(255)`,
    `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action_type VARCHAR(100)`,
    `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS input_data JSONB`,
    `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS output_data JSONB`,
    `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS error_message TEXT`,
    `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB`,
    `DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'platform') THEN
        ALTER TABLE audit_logs ALTER COLUMN "platform" DROP NOT NULL;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'senderId') THEN
        ALTER TABLE audit_logs ALTER COLUMN "senderId" DROP NOT NULL;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'userPrompt') THEN
        ALTER TABLE audit_logs ALTER COLUMN "userPrompt" DROP NOT NULL;
      END IF;
    END $$;`,

    // 10. CHANNEL_ACCOUNTS
    `CREATE TABLE IF NOT EXISTS channel_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      platform VARCHAR(50) NOT NULL DEFAULT 'ZALO',
      account_name VARCHAR(255) NOT NULL,
      auth_type VARCHAR(50) NOT NULL DEFAULT 'QR_SESSION',
      encrypted_credentials TEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'ACTIVE',
      metadata JSONB DEFAULT '{}',
      last_synced_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE channel_accounts ADD COLUMN IF NOT EXISTS platform VARCHAR(50) DEFAULT 'ZALO'`,
    `ALTER TABLE channel_accounts ADD COLUMN IF NOT EXISTS account_name VARCHAR(255)`,
    `ALTER TABLE channel_accounts ADD COLUMN IF NOT EXISTS auth_type VARCHAR(50) DEFAULT 'QR_SESSION'`,
    `ALTER TABLE channel_accounts ADD COLUMN IF NOT EXISTS encrypted_credentials TEXT`,
    `ALTER TABLE channel_accounts ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ACTIVE'`,
    `ALTER TABLE channel_accounts ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'`,
    `ALTER TABLE channel_accounts ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE`,
    `ALTER TABLE channel_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE channel_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`,

    // 11. CHANNEL_CHATS
    `CREATE TABLE IF NOT EXISTS channel_chats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID REFERENCES channel_accounts(id) ON DELETE CASCADE,
      workspace_id UUID,
      platform VARCHAR(50) NOT NULL DEFAULT 'ZALO',
      platform_chat_id VARCHAR(255) NOT NULL,
      title VARCHAR(255) NOT NULL,
      chat_type VARCHAR(50) DEFAULT 'GROUP',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(platform, platform_chat_id)
    )`,
    `ALTER TABLE channel_chats ADD COLUMN IF NOT EXISTS account_id UUID`,
    `ALTER TABLE channel_chats ADD COLUMN IF NOT EXISTS workspace_id UUID`,
    `ALTER TABLE channel_chats ADD COLUMN IF NOT EXISTS platform VARCHAR(50) DEFAULT 'ZALO'`,
    `ALTER TABLE channel_chats ADD COLUMN IF NOT EXISTS platform_chat_id VARCHAR(255)`,
    `ALTER TABLE channel_chats ADD COLUMN IF NOT EXISTS title VARCHAR(255)`,
    `ALTER TABLE channel_chats ADD COLUMN IF NOT EXISTS chat_type VARCHAR(50) DEFAULT 'GROUP'`,
    `ALTER TABLE channel_chats ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`,
    `ALTER TABLE channel_chats ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE channel_chats ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`,

    // 12. WORKSPACE_TOOL_CONFIGS
    `CREATE TABLE IF NOT EXISTS workspace_tool_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL,
      tool_group_id UUID NOT NULL,
      is_enabled BOOLEAN DEFAULT true,
      encrypted_env_overrides TEXT,
      disabled_tool_ids JSONB DEFAULT '[]',
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(workspace_id, tool_group_id)
    )`
  ];

  for (const queryStr of steps) {
    try {
      await db.query(queryStr);
    } catch (err: any) {
      console.warn(`[DB Migration Notice]: ${err.message}`);
    }
  }
}

export const ensureAllTablesSchema = ensureWorkspacesSchema;

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
