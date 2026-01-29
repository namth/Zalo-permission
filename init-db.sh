#!/bin/bash

# Initialize database from Docker
docker exec plutus-postgres psql -U plutusr -d plutusdb -f - << 'SQL'
-- Create user_profile table
CREATE TABLE IF NOT EXISTS user_profile (
  id SERIAL PRIMARY KEY,
  zalo_user_id VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create workspace_config table
CREATE TABLE IF NOT EXISTS workspace_config (
  id SERIAL PRIMARY KEY,
  workspace_id VARCHAR(255) UNIQUE NOT NULL,
  default_agent VARCHAR(255) NOT NULL,
  system_prompt TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_profile_zalo_id ON user_profile(zalo_user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_config_id ON workspace_config(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_config_status ON workspace_config(status);

-- Insert workspace config
INSERT INTO workspace_config (workspace_id, default_agent, system_prompt, status)
VALUES ('workspace_1', 'agent_support', 'Bạn là một customer support agent. Hãy trả lời câu hỏi của khách hàng một cách chuyên nghiệp và thân thiện.', 'active')
ON CONFLICT (workspace_id) DO UPDATE SET
default_agent = 'agent_support', system_prompt = 'Bạn là một customer support agent. Hãy trả lời câu hỏi của khách hàng một cách chuyên nghiệp và thân thiện.', status = 'active';

-- Insert user profile
INSERT INTO user_profile (zalo_user_id, phone, note)
VALUES ('test_user_admin', '+84901234567', 'Test admin user for development')
ON CONFLICT (zalo_user_id) DO UPDATE SET phone = '+84901234567', note = 'Test admin user for development';
SQL

echo "✅ PostgreSQL initialized"
