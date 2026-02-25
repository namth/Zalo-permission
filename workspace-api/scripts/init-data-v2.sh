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
docker exec -i -e PGPASSWORD=$POSTGRES_PASSWORD $POSTGRES_CONTAINER psql -U $POSTGRES_USER -d $POSTGRES_DB << 'EOF'

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- PHASE 1: CORE TABLES (Already exist, verify)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_profile (
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

CREATE INDEX IF NOT EXISTS idx_user_profile_zalo_id ON user_profile(zalo_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_status ON user_profile(status);

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  description TEXT,
  embedding vector(1536),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status);
CREATE INDEX IF NOT EXISTS idx_workspaces_embedding ON workspaces USING hnsw (embedding vector_cosine_ops);

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
  owner_id UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
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
  user_id UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
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
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,  -- nullable: system-level actions have no workspace
  thread_id VARCHAR(255),
  user_id UUID REFERENCES user_profile(id) ON DELETE SET NULL,
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
-- DISPLAY RESULTS
-- ============================================================================

\echo '====== POSTGRESQL CREATE COMPLETE ======'

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

CYPHER

echo -e "${GREEN}✓ Neo4j initialization complete${NC}"

echo ""
echo "Ready for Phase 2 development!"
echo "=========================================="
