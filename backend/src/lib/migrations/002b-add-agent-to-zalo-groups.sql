-- ============================================
-- MIGRATION 002b: ADD DIRECT AGENT LINK TO ZALO_GROUPS
-- Description: Add agent_key column to zalo_groups table
-- Order: Run AFTER 002a-drop-workspace-agent-config.sql
-- ============================================

-- 1. Add agent_key column (nullable initially)
ALTER TABLE zalo_groups
ADD COLUMN IF NOT EXISTS agent_key VARCHAR(100);

-- 2. Add foreign key constraint for agent_key
ALTER TABLE zalo_groups
ADD CONSTRAINT IF NOT EXISTS fk_zalo_groups_agent_key
FOREIGN KEY (agent_key) REFERENCES agents(key) ON DELETE SET NULL;

-- 3. Add index for agent_key
CREATE INDEX IF NOT EXISTS idx_zalo_groups_agent_key ON zalo_groups(agent_key);

-- 4. Verify
SELECT 'zalo_groups updated with agent_key column' as status;
