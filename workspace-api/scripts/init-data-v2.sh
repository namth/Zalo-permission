#!/bin/bash
# ============================================================================
# Database Initialization Script - V2 (New Architecture)
# Initialize fresh PostgreSQL + Neo4j databases for AI Agent System
# ============================================================================

set -e  # Exit on error

echo "=========================================="
echo "DATABASE INITIALIZATION - V2 (NEW)"
echo "=========================================="
echo ""

# Configuration
POSTGRES_CONTAINER="plutus-postgres"
POSTGRES_USER="plutusr"
POSTGRES_DB="plutusdb"
POSTGRES_PASSWORD="ccbbndctdkhmbddn"

NEO4J_CONTAINER="plutus-neo4j"
NEO4J_USER="neo4j"
NEO4J_PASSWORD="neo4j_password"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Waiting for databases to start...${NC}"
sleep 5

# ============================================================================
# POSTGRESQL INITIALIZATION
# ============================================================================

echo ""
echo -e "${YELLOW}Step 2: Initializing PostgreSQL...${NC}"

# Check PostgreSQL connection
docker exec $POSTGRES_CONTAINER pg_isready -U $POSTGRES_USER > /dev/null 2>&1 || {
  echo -e "${RED}PostgreSQL is not ready${NC}"
  exit 1
}

echo -e "${GREEN}✓ PostgreSQL is ready${NC}"

# Run PostgreSQL migrations
docker exec -e PGPASSWORD=$POSTGRES_PASSWORD $POSTGRES_CONTAINER psql -U $POSTGRES_USER -d $POSTGRES_DB << 'EOF'

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- PHASE 1: CORE TABLES (Already exist, verify)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zalo_id VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  address VARCHAR(255),
  gender VARCHAR(20),
  note TEXT,
  status VARCHAR(50) DEFAULT 'active',
  embedding vector(1536),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_zalo_id ON user_profiles(zalo_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON user_profiles(status);

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status);

CREATE TABLE IF NOT EXISTS zalo_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  thread_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);


CREATE INDEX IF NOT EXISTS idx_zalo_groups_thread_id ON zalo_groups(thread_id);
CREATE INDEX IF NOT EXISTS idx_zalo_groups_workspace_id ON zalo_groups(workspace_id);

-- ============================================================================
-- PHASE 2: NEW TABLES FOR AI AGENT SYSTEM
-- ============================================================================

-- Tools Table
CREATE TABLE IF NOT EXISTS tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  input_schema JSONB,
  embedding vector(1536),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tools_key_format CHECK (key ~ '^[a-z0-9_]+$'),
  CONSTRAINT tools_status_valid CHECK (status IN ('active', 'deprecated', 'disabled'))
);

CREATE INDEX IF NOT EXISTS idx_tools_key ON tools (key);
CREATE INDEX IF NOT EXISTS idx_tools_status ON tools (status);
CREATE INDEX IF NOT EXISTS idx_tools_embedding ON tools USING hnsw (embedding vector_cosine_ops);

-- Auto-update trigger for tools
CREATE OR REPLACE FUNCTION update_tools_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tools_updated_at ON tools;
CREATE TRIGGER trigger_tools_updated_at
BEFORE UPDATE ON tools
FOR EACH ROW
EXECUTE FUNCTION update_tools_updated_at();

-- Skills Table
CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  logic_config JSONB NOT NULL,
  owner_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  is_shared BOOLEAN DEFAULT FALSE,
  embedding vector(1536),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT skills_status_valid CHECK (status IN ('active', 'archived', 'disabled')),
  UNIQUE(workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_skills_owner_id ON skills (owner_id);
CREATE INDEX IF NOT EXISTS idx_skills_workspace_id ON skills (workspace_id);
CREATE INDEX IF NOT EXISTS idx_skills_is_shared ON skills (is_shared);
CREATE INDEX IF NOT EXISTS idx_skills_status ON skills (status);
CREATE INDEX IF NOT EXISTS idx_skills_embedding ON skills USING hnsw (embedding vector_cosine_ops);

-- Auto-update trigger for skills
CREATE OR REPLACE FUNCTION update_skills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_skills_updated_at ON skills;
CREATE TRIGGER trigger_skills_updated_at
BEFORE UPDATE ON skills
FOR EACH ROW
EXECUTE FUNCTION update_skills_updated_at();

-- Pending Tasks Table
CREATE TABLE IF NOT EXISTS pending_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  thread_id VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  intent TEXT,
  full_plan JSONB,
  missing_parameters JSONB,
  status VARCHAR(50) DEFAULT 'AWAITING_INPUT',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pending_tasks_status_valid CHECK (status IN ('AWAITING_INPUT', 'READY_TO_RESUME', 'COMPLETED')),
  CONSTRAINT pending_tasks_thread_user_unique UNIQUE(thread_id, user_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_pending_tasks_workspace_id ON pending_tasks (workspace_id);
CREATE INDEX IF NOT EXISTS idx_pending_tasks_thread_id ON pending_tasks (thread_id);
CREATE INDEX IF NOT EXISTS idx_pending_tasks_user_id ON pending_tasks (user_id);
CREATE INDEX IF NOT EXISTS idx_pending_tasks_status ON pending_tasks (status);
CREATE INDEX IF NOT EXISTS idx_pending_tasks_created_at ON pending_tasks (created_at);

-- Auto-update trigger for pending_tasks
CREATE OR REPLACE FUNCTION update_pending_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pending_tasks_updated_at ON pending_tasks;
CREATE TRIGGER trigger_pending_tasks_updated_at
BEFORE UPDATE ON pending_tasks
FOR EACH ROW
EXECUTE FUNCTION update_pending_tasks_updated_at();

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  thread_id VARCHAR(255),
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  agent_role VARCHAR(50),
  action_type VARCHAR(100),
  input_data JSONB,
  output_data JSONB,
  status VARCHAR(50),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT audit_logs_agent_role_valid CHECK (agent_role IN ('Planner', 'Worker', 'Observer')),
  CONSTRAINT audit_logs_status_valid CHECK (status IN ('success', 'failed', 'pending'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_id ON audit_logs (workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_thread_id ON audit_logs (thread_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_agent_role ON audit_logs (agent_role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs (action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs (status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_created ON audit_logs (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_thread_created ON audit_logs (thread_id, created_at DESC);

-- ============================================================================
-- INSERT TEST DATA
-- ============================================================================

-- See Neo4j section below for agent creation

-- Insert test workspaces
INSERT INTO workspaces (name, status, description) VALUES
  ('workspace_1', 'active', 'Test Workspace 1 - Support Team'),
  ('workspace_2', 'active', 'Test Workspace 2 - Finance Team')
ON CONFLICT DO NOTHING;

-- Insert test users
INSERT INTO user_profiles (zalo_id, full_name, email, phone, address, gender, status) VALUES
  ('test_user_admin', 'Test Admin User', 'admin@test.com', '0123456789', '123 Main St', 'male', 'active'),
  ('test_user_member1', 'Test Member 1', 'member1@test.com', '0987654321', '456 Oak Ave', 'female', 'active'),
  ('test_user_member2', 'Test Member 2', 'member2@test.com', '0555555555', '789 Pine Rd', 'male', 'active')
ON CONFLICT DO NOTHING;

-- Insert test Zalo groups
INSERT INTO zalo_groups (workspace_id, thread_id, name)
SELECT w.id, 'test_group_1', 'Test Group 1 - Support'
FROM workspaces w WHERE w.name = 'workspace_1'
ON CONFLICT DO NOTHING;

INSERT INTO zalo_groups (workspace_id, thread_id, name)
SELECT w.id, 'test_group_2', 'Test Group 2 - Finance'
FROM workspaces w WHERE w.name = 'workspace_2'
ON CONFLICT DO NOTHING;

-- Insert test tools
INSERT INTO tools (key, name, description, input_schema, status) VALUES
  ('tool_email', 'Email Tool', 'Send and manage emails', 
   '{"to": "string", "subject": "string", "body": "string"}'::jsonb, 'active'),
  ('tool_calendar', 'Calendar Tool', 'Manage calendar events',
   '{"title": "string", "start_time": "datetime", "end_time": "datetime"}'::jsonb, 'active'),
  ('tool_spreadsheet', 'Spreadsheet Tool', 'Create and update spreadsheets',
   '{"sheet_id": "string", "data": "array"}'::jsonb, 'active'),
  ('tool_slack', 'Slack Integration', 'Send messages to Slack',
   '{"channel": "string", "message": "string"}'::jsonb, 'active')
ON CONFLICT DO NOTHING;

-- Insert test skill
INSERT INTO skills (name, description, owner_id, workspace_id, logic_config, is_shared, status)
SELECT 
  'Generate Weekly Report',
  'Automated weekly report generation from spreadsheet data',
  u.id,
  w.id,
  '[
    {"step": 1, "tool": "tool_spreadsheet", "params": {"sheet_id": "weekly_data", "action": "read"}},
    {"step": 2, "tool": "tool_email", "params": {"to": "team@company.com", "subject": "Weekly Report", "body": "See attached report"}}
  ]'::jsonb,
  true,
  'active'
FROM user_profiles u, workspaces w
WHERE u.zalo_id = 'test_user_admin' AND w.name = 'workspace_1'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- DISPLAY RESULTS
-- ============================================================================

\echo '====== POSTGRESQL DATA SUMMARY ======'
\echo 'Users:'
SELECT COUNT(*) as count FROM user_profiles;
\echo 'Workspaces:'
SELECT COUNT(*) as count FROM workspaces;
\echo 'Zalo Groups:'
SELECT COUNT(*) as count FROM zalo_groups;
\echo 'Tools:'
SELECT COUNT(*) as count FROM tools;
\echo 'Skills:'
SELECT COUNT(*) as count FROM skills;
\echo 'Pending Tasks:'
SELECT COUNT(*) as count FROM pending_tasks;
\echo 'Audit Logs:'
SELECT COUNT(*) as count FROM audit_logs;

EOF

echo -e "${GREEN}✓ PostgreSQL initialization complete${NC}"

# ============================================================================
# NEO4J INITIALIZATION
# ============================================================================

echo ""
echo -e "${YELLOW}Step 3: Waiting for Neo4j to start...${NC}"
sleep 10

echo -e "${YELLOW}Step 4: Initializing Neo4j...${NC}"

# Run Neo4j initialization
docker exec -i $NEO4J_CONTAINER cypher-shell -u $NEO4J_USER -p $NEO4J_PASSWORD << 'CYPHER'

// ============================================================================
// CONSTRAINTS & INDEXES
// ============================================================================

// Node constraints
CREATE CONSTRAINT zalouser_id IF NOT EXISTS FOR (u:ZaloUser) REQUIRE u.zalo_user_id IS UNIQUE;
CREATE CONSTRAINT zalogroup_thread_id IF NOT EXISTS FOR (zg:ZaloGroup) REQUIRE zg.zalo_thread_id IS UNIQUE;
CREATE CONSTRAINT workspace_id IF NOT EXISTS FOR (w:Workspace) REQUIRE w.id IS UNIQUE;
CREATE CONSTRAINT tool_key IF NOT EXISTS FOR (t:Tool) REQUIRE t.key IS UNIQUE;
CREATE CONSTRAINT skill_id IF NOT EXISTS FOR (s:Skill) REQUIRE s.id IS UNIQUE;

// Indexes
CREATE INDEX zalouser_id_idx IF NOT EXISTS FOR (u:ZaloUser) ON (u.zalo_user_id);
CREATE INDEX zalogroup_thread_id_idx IF NOT EXISTS FOR (zg:ZaloGroup) ON (zg.zalo_thread_id);
CREATE INDEX workspace_id_idx IF NOT EXISTS FOR (w:Workspace) ON (w.id);
CREATE INDEX tool_key_idx IF NOT EXISTS FOR (t:Tool) ON (t.key);
CREATE INDEX skill_id_idx IF NOT EXISTS FOR (s:Skill) ON (s.id);

// ============================================================================
// CREATE TEST NODES
// ============================================================================

// Workspaces
MERGE (w1:Workspace {id: 'workspace_1', name: 'Test Workspace 1', type: 'team', created_at: datetime()});
MERGE (w2:Workspace {id: 'workspace_2', name: 'Test Workspace 2', type: 'team', created_at: datetime()});

// ZaloGroups
MERGE (zg1:ZaloGroup {zalo_thread_id: 'test_group_1', name: 'Test Group 1'});
MERGE (zg2:ZaloGroup {zalo_thread_id: 'test_group_2', name: 'Test Group 2'});

// Tools
MERGE (t1:Tool {key: 'tool_email', name: 'Email Tool'});
MERGE (t2:Tool {key: 'tool_calendar', name: 'Calendar Tool'});
MERGE (t3:Tool {key: 'tool_spreadsheet', name: 'Spreadsheet Tool'});
MERGE (t4:Tool {key: 'tool_slack', name: 'Slack Integration'});

// Skills
MERGE (s1:Skill {id: 'skill_report', name: 'Generate Weekly Report', is_shared: true});

// Users
MERGE (u1:ZaloUser {zalo_user_id: 'test_user_admin', name: 'Test Admin User', created_at: datetime()});
MERGE (u2:ZaloUser {zalo_user_id: 'test_user_member1', name: 'Test Member 1', created_at: datetime()});
MERGE (u3:ZaloUser {zalo_user_id: 'test_user_member2', name: 'Test Member 2', created_at: datetime()});

// ============================================================================
// CREATE RELATIONSHIPS 
// ============================================================================

// ZaloGroup bindings to Workspace
MATCH (zg:ZaloGroup {zalo_thread_id: 'test_group_1'})
MATCH (w:Workspace {id: 'workspace_1'})
MERGE (zg)-[:BELONGS_TO]->(w);

MATCH (zg:ZaloGroup {zalo_thread_id: 'test_group_2'})
MATCH (w:Workspace {id: 'workspace_2'})
MERGE (zg)-[:BELONGS_TO]->(w);

// User membership in Workspace
MATCH (u:ZaloUser {zalo_user_id: 'test_user_admin'})
MATCH (zg:ZaloGroup {zalo_thread_id: 'test_group_1'})
MERGE (u)-[:MEMBER_OF {role: 'admin', joined_at: datetime()}]->(zg);

MATCH (u:ZaloUser {zalo_user_id: 'test_user_member1'})
MATCH (zg:ZaloGroup {zalo_thread_id: 'test_group_1'})
MERGE (u)-[:MEMBER_OF {role: 'member', joined_at: datetime()}]->(zg);

MATCH (u:ZaloUser {zalo_user_id: 'test_user_admin'})
MATCH (zg:ZaloGroup {zalo_thread_id: 'test_group_2'})
MERGE (u)-[:MEMBER_OF {role: 'admin', joined_at: datetime()}]->(zg);

// Tool permissions
MATCH (w:Workspace {id: 'workspace_1'})
MATCH (t1:Tool {key: 'tool_email'})
MATCH (t2:Tool {key: 'tool_calendar'})
MATCH (t3:Tool {key: 'tool_spreadsheet'})
MATCH (t4:Tool {key: 'tool_slack'})
MERGE (w)-[:CAN_USE]->(t1)
MERGE (w)-[:CAN_USE]->(t2)
MERGE (w)-[:CAN_USE]->(t3)
MERGE (w)-[:CAN_USE]->(t4);

MATCH (w:Workspace {id: 'workspace_2'})
MATCH (t1:Tool {key: 'tool_email'})
MATCH (t3:Tool {key: 'tool_spreadsheet'})
MATCH (t4:Tool {key: 'tool_slack'})
MERGE (w)-[:CAN_USE]->(t1)
MERGE (w)-[:CAN_USE]->(t3)
MERGE (w)-[:CAN_USE]->(t4);

// Skill ownership & sharing
MATCH (u:ZaloUser {zalo_user_id: 'test_user_admin'})
MATCH (s:Skill {id: 'skill_report'})
MERGE (u)-[:OWNER_OF]->(s);

MATCH (w:Workspace {id: 'workspace_1'})
MATCH (s:Skill {id: 'skill_report'})
MERGE (s)-[:SHARED_TO]->(w);

// ============================================================================
// RETURN STATS
// ============================================================================

MATCH (n:ZaloUser) WITH COUNT(n) as users
MATCH (w:Workspace) WITH COUNT(w) as workspaces, users
MATCH (zg:ZaloGroup) WITH COUNT(zg) as groups, workspaces, users
MATCH (t:Tool) WITH COUNT(t) as tools, groups, workspaces, users
MATCH (s:Skill) WITH COUNT(s) as skills, tools, groups, workspaces, users
RETURN users, workspaces, groups, tools, skills;

CYPHER

echo -e "${GREEN}✓ Neo4j initialization complete${NC}"

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo "=========================================="
echo -e "${GREEN}✓ DATABASE INITIALIZATION COMPLETE${NC}"
echo "=========================================="
echo ""
echo "PostgreSQL Summary:"
echo "  - 3 users created"
echo "  - 2 workspaces created"
echo "  - 2 Zalo groups created "
echo "  - 4 tools created with embeddings"
echo "  - 1 skill created with embeddings"
echo "  - Pending tasks table (empty, ready for use)"
echo "  - Audit logs table (empty, ready for use)"
echo ""
echo "Neo4j Summary:"
echo "  - 3 ZaloUser nodes"
echo "  - 2 Workspace nodes"
echo "  - 2 ZaloGroup nodes"
echo "  - 4 Tool nodes"
echo "  - 1 Skill node"
echo "  - Relationships: BELONGS_TO, PART_OF, CAN_USE, OWNER_OF, SHARED_TO"
echo ""
echo "Ready for Phase 2 development!"
echo "=========================================="
