// ============================================================================
// NEO4J INITIALIZATION SCRIPT - V2 (New Architecture)
// Constraints, Indexes, and Test Data for AI Agent System
// ============================================================================

// ============================================================================
// CONSTRAINTS & INDEXES - Node Unique Properties
// ============================================================================

// ZaloUser constraints
// Properties: zalo_user_id, name, created_at
CREATE CONSTRAINT zalouser_id IF NOT EXISTS FOR (u:ZaloUser) REQUIRE u.zalo_user_id IS UNIQUE;

// ZaloGroup constraints
// Properties: id, zalo_thread_id, name, created_at, updated_at, status
CREATE CONSTRAINT zalogroup_thread_id IF NOT EXISTS FOR (zg:ZaloGroup) REQUIRE zg.zalo_thread_id IS UNIQUE;
CREATE CONSTRAINT zalogroup_id IF NOT EXISTS FOR (zg:ZaloGroup) REQUIRE zg.id IS UNIQUE;

// Workspace constraints
CREATE CONSTRAINT workspace_id IF NOT EXISTS FOR (w:Workspace) REQUIRE w.id IS UNIQUE;

// Tool constraints (NEW)
CREATE CONSTRAINT tool_key IF NOT EXISTS FOR (t:Tool) REQUIRE t.key IS UNIQUE;

// Skill constraints (NEW)
CREATE CONSTRAINT skill_id IF NOT EXISTS FOR (s:Skill) REQUIRE s.id IS UNIQUE;

// ============================================================================
// INDEXES - Performance optimization
// ============================================================================

CREATE INDEX zalouser_id_idx IF NOT EXISTS FOR (u:ZaloUser) ON (u.zalo_user_id);
CREATE INDEX zalogroup_thread_id_idx IF NOT EXISTS FOR (zg:ZaloGroup) ON (zg.zalo_thread_id);
CREATE INDEX zalogroup_id_idx IF NOT EXISTS FOR (zg:ZaloGroup) ON (zg.id);
CREATE INDEX zalogroup_name_idx IF NOT EXISTS FOR (zg:ZaloGroup) ON (zg.name);
CREATE INDEX workspace_id_idx IF NOT EXISTS FOR (w:Workspace) ON (w.id);
CREATE INDEX tool_key_idx IF NOT EXISTS FOR (t:Tool) ON (t.key);
CREATE INDEX skill_id_idx IF NOT EXISTS FOR (s:Skill) ON (s.id);

// ============================================================================
// CREATE TEST NODES - Workspaces
// ============================================================================

MERGE (w1:Workspace {id: 'workspace_1', name: 'Test Workspace 1 - Support Team', type: 'team', created_at: datetime()});
MERGE (w2:Workspace {id: 'workspace_2', name: 'Test Workspace 2 - Finance Team', type: 'team', created_at: datetime()});

// ============================================================================
// CREATE TEST NODES - ZaloGroups (with name field)
// ============================================================================

MERGE (zg1:ZaloGroup {zalo_thread_id: 'test_group_1', name: 'Test Group 1 - Support', created_at: datetime()});
MERGE (zg2:ZaloGroup {zalo_thread_id: 'test_group_2', name: 'Test Group 2 - Finance', created_at: datetime()});

// ============================================================================
// CREATE TEST NODES - Tools (NEW)
// ============================================================================

MERGE (t1:Tool {key: 'tool_email', name: 'Email Tool', description: 'Send and manage emails', created_at: datetime()});
MERGE (t2:Tool {key: 'tool_calendar', name: 'Calendar Tool', description: 'Manage calendar events', created_at: datetime()});
MERGE (t3:Tool {key: 'tool_spreadsheet', name: 'Spreadsheet Tool', description: 'Create and update spreadsheets', created_at: datetime()});
MERGE (t4:Tool {key: 'tool_slack', name: 'Slack Integration', description: 'Send messages to Slack', created_at: datetime()});

// ============================================================================
// CREATE TEST NODES - Skills (NEW)
// ============================================================================

MERGE (s1:Skill {id: 'skill_report', name: 'Generate Weekly Report', description: 'Automated weekly report generation', is_shared: true, created_at: datetime()});

// ============================================================================
// CREATE TEST NODES - Users
// ============================================================================

MERGE (u1:ZaloUser {zalo_user_id: 'test_user_admin', name: 'Test Admin User', created_at: datetime()});
MERGE (u2:ZaloUser {zalo_user_id: 'test_user_member1', name: 'Test Member 1', created_at: datetime()});
MERGE (u3:ZaloUser {zalo_user_id: 'test_user_member2', name: 'Test Member 2', created_at: datetime()});

// ============================================================================
// CREATE RELATIONSHIPS - ZaloGroup to Workspace
// ============================================================================

// ZaloGroup 1 -> Workspace 1
MATCH (zg:ZaloGroup {zalo_thread_id: 'test_group_1'})
MATCH (w:Workspace {id: 'workspace_1'})
MERGE (zg)-[:BELONGS_TO]->(w);

// ZaloGroup 2 -> Workspace 2
MATCH (zg:ZaloGroup {zalo_thread_id: 'test_group_2'})
MATCH (w:Workspace {id: 'workspace_2'})
MERGE (zg)-[:BELONGS_TO]->(w);

// ============================================================================
// CREATE RELATIONSHIPS - User to Workspace (PART_OF)
// ============================================================================

// User 1 (Admin) -> Workspace 1
MATCH (u:ZaloUser {zalo_user_id: 'test_user_admin'})
MATCH (w:Workspace {id: 'workspace_1'})
MERGE (u)-[:PART_OF {role: 'admin', joined_at: datetime()}]->(w);

// User 2 (Member) -> Workspace 1
MATCH (u:ZaloUser {zalo_user_id: 'test_user_member1'})
MATCH (w:Workspace {id: 'workspace_1'})
MERGE (u)-[:PART_OF {role: 'member', joined_at: datetime()}]->(w);

// User 1 (Admin) -> Workspace 2
MATCH (u:ZaloUser {zalo_user_id: 'test_user_admin'})
MATCH (w:Workspace {id: 'workspace_2'})
MERGE (u)-[:PART_OF {role: 'admin', joined_at: datetime()}]->(w);

// ============================================================================
// CREATE RELATIONSHIPS - Workspace to Tool (CAN_USE) - NEW
// ============================================================================

// Workspace 1 can use all 4 tools
MATCH (w:Workspace {id: 'workspace_1'})
MATCH (t:Tool {key: 'tool_email'})
MERGE (w)-[:CAN_USE]->(t);

MATCH (w:Workspace {id: 'workspace_1'})
MATCH (t:Tool {key: 'tool_calendar'})
MERGE (w)-[:CAN_USE]->(t);

MATCH (w:Workspace {id: 'workspace_1'})
MATCH (t:Tool {key: 'tool_spreadsheet'})
MERGE (w)-[:CAN_USE]->(t);

MATCH (w:Workspace {id: 'workspace_1'})
MATCH (t:Tool {key: 'tool_slack'})
MERGE (w)-[:CAN_USE]->(t);

// Workspace 2 can use email, spreadsheet, slack (no calendar)
MATCH (w:Workspace {id: 'workspace_2'})
MATCH (t:Tool {key: 'tool_email'})
MERGE (w)-[:CAN_USE]->(t);

MATCH (w:Workspace {id: 'workspace_2'})
MATCH (t:Tool {key: 'tool_spreadsheet'})
MERGE (w)-[:CAN_USE]->(t);

MATCH (w:Workspace {id: 'workspace_2'})
MATCH (t:Tool {key: 'tool_slack'})
MERGE (w)-[:CAN_USE]->(t);

// ============================================================================
// CREATE RELATIONSHIPS - User to Skill (OWNER_OF) - NEW
// ============================================================================

MATCH (u:ZaloUser {zalo_user_id: 'test_user_admin'})
MATCH (s:Skill {id: 'skill_report'})
MERGE (u)-[:OWNER_OF]->(s);

// ============================================================================
// CREATE RELATIONSHIPS - Skill to Workspace (SHARED_TO) - NEW
// ============================================================================

MATCH (w:Workspace {id: 'workspace_1'})
MATCH (s:Skill {id: 'skill_report'})
MERGE (s)-[:SHARED_TO]->(w);

// ============================================================================
// VERIFY SETUP - Count nodes and relationships
// ============================================================================

MATCH (n:ZaloUser) WITH COUNT(n) as users
MATCH (w:Workspace) WITH COUNT(w) as workspaces, users
MATCH (zg:ZaloGroup) WITH COUNT(zg) as groups, workspaces, users
MATCH (t:Tool) WITH COUNT(t) as tools, groups, workspaces, users
MATCH (s:Skill) WITH COUNT(s) as skills, tools, groups, workspaces, users
RETURN users, workspaces, groups, tools, skills;
