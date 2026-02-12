-- Migration 006: Alter zalo_groups table - add agent_key column
-- Description: Add agent_key to directly link ZaloGroup to Agent
-- This replaces the pattern of resolving agent through workspace
-- Date: 2026-02-09

-- Add agent_key column if it doesn't exist
ALTER TABLE zalo_groups
ADD COLUMN IF NOT EXISTS agent_key VARCHAR(100);

-- Add foreign key constraint
ALTER TABLE zalo_groups
ADD CONSTRAINT fk_zalo_groups_agent_key 
FOREIGN KEY (agent_key) REFERENCES agents(key) ON DELETE SET NULL;

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_zalo_groups_agent_key ON zalo_groups (agent_key);

-- Add comment
COMMENT ON COLUMN zalo_groups.agent_key IS 'Direct link to the agent used by this Zalo group';

-- Note: This migration assumes 'agents' table already exists
-- If not, it will be created separately
