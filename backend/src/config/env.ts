/**
 * Environment Configuration
 * Centralize all environment variables and validate them
 */

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && !defaultValue) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || defaultValue || '';
}

function getEnvInt(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value ? parseInt(value, 10) : defaultValue || 0;
}

function getEnvBool(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

export const config = {
  // App
  app: {
    env: getEnv('NODE_ENV', 'development'),
    port: getEnvInt('PORT', 3000),
    isDev: getEnv('NODE_ENV', 'development') === 'development',
    isProd: getEnv('NODE_ENV', 'development') === 'production',
  },

  // Database - Neo4j
  neo4j: {
    uri: getEnv('NEO4J_URI', 'bolt://localhost:7687'),
    user: getEnv('NEO4J_USER', 'neo4j'),
    password: getEnv('NEO4J_PASSWORD', 'password'),
  },

  // Database - PostgreSQL
  postgres: {
    url: getEnv('DATABASE_URL', ''),
    max: getEnvInt('DB_POOL_MAX', 20),
    idleTimeoutMillis: getEnvInt('DB_IDLE_TIMEOUT', 30000),
    connectionTimeoutMillis: getEnvInt('DB_CONNECTION_TIMEOUT', 2000),
  },

  // API
  api: {
    timeout: getEnvInt('API_TIMEOUT', 30000),
  },

  // Logging
  logging: {
    level: getEnv('LOG_LEVEL', 'info'),
    format: getEnv('LOG_FORMAT', 'json'),
  },
} as const;

/**
 * Validate critical environment variables on startup
 */
export function validateConfig(): void {
  const required = [
    'NEO4J_URI',
    'NEO4J_USER',
    'NEO4J_PASSWORD',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing);
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  // PostgreSQL is optional for development (can use memory store)
  if (config.app.isProd && !process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in production');
  }
}

export default config;
