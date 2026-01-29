#!/bin/bash
# Initialize database structures and test data

echo "=== Initializing Neo4j ==="
docker exec plutus-neo4j cypher-shell \
  -u neo4j -p "$NEO4J_PASSWORD" \
  -f /scripts/neo4j-init.cypher

echo "=== Initializing PostgreSQL ==="
docker exec plutus-postgres psql \
  -U plutusr -d plutusdb << 'EOF'
-- Create tables
CREATE TABLE IF NOT EXISTS user_profile (
  id SERIAL PRIMARY KEY,
  zalo_user_id VARCHAR UNIQUE,
  name VARCHAR,
  phone VARCHAR,
  note TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_config (
  id SERIAL PRIMARY KEY,
  workspace_id VARCHAR UNIQUE,
  agent_key VARCHAR,
  system_prompt TEXT,
  status VARCHAR DEFAULT 'active',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_zalo ON user_profile(zalo_user_id);
CREATE INDEX IF NOT EXISTS idx_workspace ON workspace_config(workspace_id);

-- Insert test data (optional)
INSERT INTO workspace_config (workspace_id, agent_key, system_prompt, status)
VALUES ('workspace_1', 'agent_support', 'You are a support agent', 'active')
ON CONFLICT (workspace_id) DO NOTHING;

EOF

echo "=== Database initialization complete ==="
