-- ============================================
-- MIGRATION 002a: DROP DEPRECATED TABLE
-- Description: Remove workspace_agent_config table (v1.0 legacy)
-- Reason: Agent configuration now stored directly in zalo_groups.agent_key
-- Order: Run BEFORE 002b-add-agent-to-zalo-groups.sql
-- ============================================

-- 1. Drop the deprecated table (if exists)
DROP TABLE IF EXISTS workspace_agent_config CASCADE;

-- 2. Verify drop
SELECT 'workspace_agent_config table removed' as status;
