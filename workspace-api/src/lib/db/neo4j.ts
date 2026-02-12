import neo4j, { Driver, Session } from 'neo4j-driver';

let driver: Driver | null = null;

/**
 * Initialize Neo4j driver
 */
export function initNeo4j(): Driver {
  if (driver) return driver;

  const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const user = process.env.NEO4J_USER || 'neo4j';
  const password = process.env.NEO4J_PASSWORD || 'password';

  driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
    disableLosslessIntegers: true,
    connectionAcquisitionTimeout: 10000,
    encrypted: 'ENCRYPTION_OFF',
  });
  return driver;
}

/**
 * Get Neo4j driver instance
 */
export function getNeo4j(): Driver {
  if (!driver) {
    return initNeo4j();
  }
  return driver;
}

/**
 * Execute a Cypher query
 */
export async function executeQuery(query: string, params: Record<string, any> = {}) {
  const driverInstance = getNeo4j();
  const session = driverInstance.session();

  try {
    const result = await session.run(query, params);
    return result;
  } finally {
    await session.close();
  }
}

/**
 * Close Neo4j driver
 */
export async function closeNeo4j(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

/**
 * Test Neo4j connection
 */
export async function testNeo4jConnection(): Promise<boolean> {
  try {
    const result = await executeQuery('RETURN 1 as value');
    return result.records.length > 0;
  } catch (error) {
    console.error('Neo4j connection failed:', error);
    return false;
  }
}
