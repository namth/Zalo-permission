import { executeQuery } from './neo4j';

/**
 * Create Neo4j constraints and indexes
 */
export async function setupNeo4jSchema(): Promise<void> {
  try {
    console.log('🗄️ Setting up Neo4j schema...');

    // Create constraints
    console.log('Creating constraints...');
    
    try {
      await executeQuery(
        `CREATE CONSTRAINT zalouser_id IF NOT EXISTS 
         FOR (u:ZaloUser) REQUIRE u.zalo_user_id IS UNIQUE`
      );
      console.log('✅ Created constraint on ZaloUser.zalo_user_id');
    } catch (error) {
      console.log('Constraint on ZaloUser.zalo_user_id already exists');
    }

    try {
      await executeQuery(
        `CREATE CONSTRAINT zalogroup_thread_id IF NOT EXISTS 
         FOR (zg:ZaloGroup) REQUIRE zg.zalo_thread_id IS UNIQUE`
      );
      console.log('✅ Created constraint on ZaloGroup.zalo_thread_id');
    } catch (error) {
      console.log('Constraint on ZaloGroup.zalo_thread_id already exists');
    }

    try {
      await executeQuery(
        `CREATE CONSTRAINT workspace_id IF NOT EXISTS 
         FOR (w:Workspace) REQUIRE w.id IS UNIQUE`
      );
      console.log('✅ Created constraint on Workspace.id');
    } catch (error) {
      console.log('Constraint on Workspace.id already exists');
    }

    try {
      await executeQuery(
        `CREATE CONSTRAINT agent_key IF NOT EXISTS 
         FOR (a:Agent) REQUIRE a.key IS UNIQUE`
      );
      console.log('✅ Created constraint on Agent.key');
    } catch (error) {
      console.log('Constraint on Agent.key already exists');
    }

    // Create indexes
    console.log('Creating indexes...');

    try {
      await executeQuery(
        `CREATE INDEX zalouser_id_idx IF NOT EXISTS 
         FOR (u:ZaloUser) ON (u.zalo_user_id)`
      );
      console.log('✅ Created index on ZaloUser.zalo_user_id');
    } catch (error) {
      console.log('Index on ZaloUser.zalo_user_id already exists');
    }

    try {
      await executeQuery(
        `CREATE INDEX zalogroup_thread_id_idx IF NOT EXISTS 
         FOR (zg:ZaloGroup) ON (zg.zalo_thread_id)`
      );
      console.log('✅ Created index on ZaloGroup.zalo_thread_id');
    } catch (error) {
      console.log('Index on ZaloGroup.zalo_thread_id already exists');
    }

    try {
      await executeQuery(
        `CREATE INDEX workspace_id_idx IF NOT EXISTS 
         FOR (w:Workspace) ON (w.id)`
      );
      console.log('✅ Created index on Workspace.id');
    } catch (error) {
      console.log('Index on Workspace.id already exists');
    }

    try {
      await executeQuery(
        `CREATE INDEX agent_key_idx IF NOT EXISTS 
         FOR (a:Agent) ON (a.key)`
      );
      console.log('✅ Created index on Agent.key');
    } catch (error) {
      console.log('Index on Agent.key already exists');
    }

    console.log('✅ Neo4j schema setup completed');
  } catch (error) {
    console.error('❌ Neo4j schema setup failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  setupNeo4jSchema()
    .then(() => {
      console.log('Schema setup completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Schema setup error:', error);
      process.exit(1);
    });
}
