import { executeQuery } from './neo4j';
import { query } from './db';

/**
 * Seed test data for development
 */
export async function seedDatabase(): Promise<void> {
  try {
    console.log('🌱 Seeding test data...');

    // Create test ZaloGroup
    console.log('Creating test ZaloGroup...');
    await executeQuery(
      `MERGE (zg:ZaloGroup {zalo_thread_id: $zalo_thread_id})
       RETURN zg`,
      { zalo_thread_id: 'test_group_1' }
    );

    // Create test Workspace
    console.log('Creating test Workspace...');
    await executeQuery(
      `MERGE (w:Workspace {id: $id, name: $name, type: $type, created_at: datetime()})
       RETURN w`,
      { id: 'workspace_1', name: 'Test Workspace', type: 'team' }
    );

    // Create test Agent
    console.log('Creating test Agent...');
    await executeQuery(
      `MERGE (a:Agent {key: $key, type: $type})
       RETURN a`,
      { key: 'agent_support', type: 'ai_agent' }
    );

    // Bind ZaloGroup to Workspace
    console.log('Binding ZaloGroup to Workspace...');
    await executeQuery(
      `MATCH (zg:ZaloGroup {zalo_thread_id: $zalo_thread_id})
       MATCH (w:Workspace {id: $workspace_id})
       MERGE (zg)-[:BINDS_TO]->(w)
       RETURN true`,
      { zalo_thread_id: 'test_group_1', workspace_id: 'workspace_1' }
    );

    // Bind Agent to Workspace
    console.log('Binding Agent to Workspace...');
    await executeQuery(
      `MATCH (w:Workspace {id: $workspace_id})
       MATCH (a:Agent {key: $agent_key})
       MERGE (w)-[:USES]->(a)
       RETURN true`,
      { workspace_id: 'workspace_1', agent_key: 'agent_support' }
    );

    // Create test ZaloUser
    console.log('Creating test ZaloUser...');
    await executeQuery(
      `MERGE (u:ZaloUser {zalo_user_id: $zalo_user_id, name: $name, created_at: datetime()})
       RETURN u`,
      { zalo_user_id: 'test_user_admin', name: 'Test Admin User' }
    );

    // Create MEMBER_OF relationship with ZaloGroup
    console.log('Creating MEMBER_OF relationship with ZaloGroup...');
    await executeQuery(
      `MATCH (u:ZaloUser {zalo_user_id: $zalo_user_id})
       MATCH (zg:ZaloGroup {zalo_thread_id: $zalo_thread_id})
       MERGE (u)-[:MEMBER_OF {role: $role, joined_at: datetime()}]->(zg)
       RETURN true`,
      { zalo_user_id: 'test_user_admin', zalo_thread_id: 'test_group_1', role: 'admin' }
    );

    // Create PART_OF relationship with Workspace
    console.log('Creating PART_OF relationship with Workspace...');
    await executeQuery(
      `MATCH (u:ZaloUser {zalo_user_id: $zalo_user_id})
       MATCH (w:Workspace {id: $workspace_id})
       MERGE (u)-[:PART_OF {joined_at: datetime()}]->(w)
       RETURN true`,
      { zalo_user_id: 'test_user_admin', workspace_id: 'workspace_1' }
    );

    // Insert workspace config
    console.log('Inserting workspace config...');
    await query(
      `INSERT INTO workspace_config (workspace_id, default_agent, system_prompt, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (workspace_id) DO UPDATE SET
       default_agent = $2, system_prompt = $3, status = $4
       RETURNING *`,
      [
        'workspace_1',
        'agent_support',
        'Bạn là một customer support agent. Hãy trả lời câu hỏi của khách hàng một cách chuyên nghiệp và thân thiện.',
        'active'
      ]
    );

    // Insert new user profile (in users table)
    console.log('Inserting user profile (new users table)...');
    await query(
      `INSERT INTO users (zalo_id, name, email, phone, address, gender)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (zalo_id) DO UPDATE SET
       email = $3, phone = $4, address = $5, gender = $6
       RETURNING *`,
      [
        'test_user_admin',
        'Test Admin User',
        'admin@test.com',
        '+84901234567',
        'Ho Chi Minh City, Vietnam',
        'male'
      ]
    );

    // Insert legacy user profile (for backward compatibility)
    console.log('Inserting user profile (legacy user_profile table)...');
    await query(
      `INSERT INTO user_profile (zalo_user_id, phone, note)
       VALUES ($1, $2, $3)
       ON CONFLICT (zalo_user_id) DO UPDATE SET phone = $2, note = $3
       RETURNING *`,
      [
        'test_user_admin',
        '+84901234567',
        'Test admin user for development'
      ]
    );

    console.log('✅ Seeding completed successfully');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('Seed completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seed error:', error);
      process.exit(1);
    });
}
