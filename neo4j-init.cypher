// Create constraints
CREATE CONSTRAINT zalouser_id IF NOT EXISTS FOR (u:ZaloUser) REQUIRE u.zalo_user_id IS UNIQUE;
CREATE CONSTRAINT zalogroup_thread_id IF NOT EXISTS FOR (zg:ZaloGroup) REQUIRE zg.zalo_thread_id IS UNIQUE;
CREATE CONSTRAINT workspace_id IF NOT EXISTS FOR (w:Workspace) REQUIRE w.id IS UNIQUE;
CREATE CONSTRAINT agent_key IF NOT EXISTS FOR (a:Agent) REQUIRE a.key IS UNIQUE;

// Create indexes
CREATE INDEX zalouser_id_idx IF NOT EXISTS FOR (u:ZaloUser) ON (u.zalo_user_id);
CREATE INDEX zalogroup_thread_id_idx IF NOT EXISTS FOR (zg:ZaloGroup) ON (zg.zalo_thread_id);
CREATE INDEX workspace_id_idx IF NOT EXISTS FOR (w:Workspace) ON (w.id);
CREATE INDEX agent_key_idx IF NOT EXISTS FOR (a:Agent) ON (a.key);

// Create test nodes
MERGE (zg:ZaloGroup {zalo_thread_id: 'test_group_1'});
MERGE (w:Workspace {id: 'workspace_1', name: 'Test Workspace', type: 'team', created_at: datetime()});
MERGE (a:Agent {key: 'agent_support', type: 'ai_agent'});
MERGE (u:ZaloUser {zalo_user_id: 'test_user_admin', name: 'Test Admin User', created_at: datetime()});

// Create relationships
MATCH (zg:ZaloGroup {zalo_thread_id: 'test_group_1'})
MATCH (w:Workspace {id: 'workspace_1'})
MERGE (zg)-[:BINDS_TO]->(w);

MATCH (w:Workspace {id: 'workspace_1'})
MATCH (a:Agent {key: 'agent_support'})
MERGE (w)-[:USES]->(a);

MATCH (u:ZaloUser {zalo_user_id: 'test_user_admin'})
MATCH (w:Workspace {id: 'workspace_1'})
MERGE (u)-[:MEMBER_OF {role: 'admin', joined_at: datetime()}]->(w);
