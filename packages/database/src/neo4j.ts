import neo4j, { Driver, Session } from 'neo4j-driver';
import { ensureEnvLoaded } from './env.js';

declare global {
  // eslint-disable-next-line no-var
  var neo4jDriverGlobal: Driver | undefined;
}

export function getNeo4jDriver(): Driver {
  ensureEnvLoaded();
  if (global.neo4jDriverGlobal) {
    return global.neo4jDriverGlobal;
  }

  const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const user = process.env.NEO4J_USER || 'neo4j';
  const password = process.env.NEO4J_PASSWORD || 'neo4j_password_here';

  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
    maxConnectionPoolSize: 50,
    connectionTimeout: 10000,
  });

  if (process.env.NODE_ENV !== 'production') {
    global.neo4jDriverGlobal = driver;
  }

  return driver;
}

export const neo4jDriver = getNeo4jDriver();

/**
 * Tiện ích thực thi câu truy vấn Cypher với Session tự động dọn dẹp
 */
export async function runCypher<T = Record<string, unknown>>(
  cypherQuery: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  const driver = getNeo4jDriver();
  const session: Session = driver.session();
  try {
    const result = await session.run(cypherQuery, params);
    return result.records.map((record) => record.toObject() as T);
  } finally {
    await session.close();
  }
}
