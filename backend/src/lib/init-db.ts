import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

import { runMigrations } from './migrations/run-migrations';
import { setupNeo4jSchema } from './neo4j-schema';
import { seedDatabase } from './seed';
import { testNeo4jConnection, closeNeo4j } from './neo4j';
import { testDbConnection, closeDb } from './db';

/**
 * Initialize all databases
 */
export async function initializeDatabase(): Promise<void> {
  try {
    console.log('🚀 Initializing databases...\n');

    // Test connections
    console.log('Testing database connections...');
    const dbConnected = await testDbConnection();
    const neo4jConnected = await testNeo4jConnection();

    if (!dbConnected) {
      console.error('❌ PostgreSQL connection failed');
      process.exit(1);
    }
    console.log('✅ PostgreSQL connected');

    if (!neo4jConnected) {
      console.error('❌ Neo4j connection failed');
      process.exit(1);
    }
    console.log('✅ Neo4j connected\n');

    // Run migrations
    console.log('Running PostgreSQL migrations...\n');
    await runMigrations();
    console.log('');

    // Setup Neo4j schema
    console.log('Setting up Neo4j schema...\n');
    await setupNeo4jSchema();
    console.log('');

    // Seed database
    console.log('Seeding test data...\n');
    await seedDatabase();
    console.log('');

    console.log('✅ Database initialization completed\n');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    await closeNeo4j();
    await closeDb();
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase().then(() => process.exit(0));
}
