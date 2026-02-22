-- ============================================
-- MIGRATION 004: REMOVE AGENTS TABLE
-- Description: Drop agents table as the concept is removed from the system.
-- Order: Run AFTER 003
-- ============================================

DROP TABLE IF EXISTS agents CASCADE;

-- Also verify workspace_agent_config is gone (should be handled by 002a but just in case)
DROP TABLE IF EXISTS workspace_agent_config CASCADE;

SELECT 'Agents table dropped' as status;
