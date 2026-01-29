import { executeQuery } from './neo4j';

/**
 * Initialize Neo4j v3 schema
 * Creates constraints and indexes for the new permission system
 */
export async function initializeNeo4jSchema(): Promise<void> {
  try {
    console.log('Initializing Neo4j schema v3...');

    // Create unique constraints
    const constraints = [
      {
        name: 'user_id_constraint',
        query: 'CREATE CONSTRAINT user_id_constraint IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE'
      },
      {
        name: 'user_zalo_id_constraint',
        query: 'CREATE CONSTRAINT user_zalo_id_constraint IF NOT EXISTS FOR (u:User) REQUIRE u.zalo_id IS UNIQUE'
      },
      {
        name: 'zalogroup_id_constraint',
        query: 'CREATE CONSTRAINT zalogroup_id_constraint IF NOT EXISTS FOR (g:ZaloGroup) REQUIRE g.id IS UNIQUE'
      },
      {
        name: 'zalogroup_thread_id_constraint',
        query: 'CREATE CONSTRAINT zalogroup_thread_id_constraint IF NOT EXISTS FOR (g:ZaloGroup) REQUIRE g.thread_id IS UNIQUE'
      },
      {
        name: 'workspace_id_constraint',
        query: 'CREATE CONSTRAINT workspace_id_constraint IF NOT EXISTS FOR (w:Workspace) REQUIRE w.id IS UNIQUE'
      },
      {
        name: 'agent_key_constraint',
        query: 'CREATE CONSTRAINT agent_key_constraint IF NOT EXISTS FOR (a:Agent) REQUIRE a.key IS UNIQUE'
      },
    ];

    for (const constraint of constraints) {
      try {
        await executeQuery(constraint.query);
        console.log(`✅ Created constraint: ${constraint.name}`);
      } catch (error: any) {
        if (error.message && error.message.includes('already exists')) {
          console.log(`ℹ️  Constraint already exists: ${constraint.name}`);
        } else {
          throw error;
        }
      }
    }

    // Create indexes
    const indexes = [
      {
        name: 'user_zalo_id_index',
        query: 'CREATE INDEX user_zalo_id_index IF NOT EXISTS FOR (u:User) ON (u.zalo_id)'
      },
      {
        name: 'zalogroup_thread_id_index',
        query: 'CREATE INDEX zalogroup_thread_id_index IF NOT EXISTS FOR (g:ZaloGroup) ON (g.thread_id)'
      },
      {
        name: 'workspace_name_index',
        query: 'CREATE INDEX workspace_name_index IF NOT EXISTS FOR (w:Workspace) ON (w.name)'
      },
    ];

    for (const index of indexes) {
      try {
        await executeQuery(index.query);
        console.log(`✅ Created index: ${index.name}`);
      } catch (error: any) {
        if (error.message && error.message.includes('already exists')) {
          console.log(`ℹ️  Index already exists: ${index.name}`);
        } else {
          throw error;
        }
      }
    }

    console.log('✅ Neo4j schema v3 initialization completed');
  } catch (error) {
    console.error('❌ Neo4j schema initialization failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  initializeNeo4jSchema()
    .then(() => {
      console.log('Neo4j schema initialized successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Neo4j initialization error:', error);
      process.exit(1);
    });
}
