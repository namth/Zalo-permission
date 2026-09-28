-- ============================================
-- MIGRATION 003: REMOVE AGENT_KEY FROM ZALO_GROUPS
-- Description: Remove agent_key as it is no longer used (per AAWS spec)
-- Order: Run AFTER 002d-fix-missing-columns.sql
-- ============================================

-- 1. Drop Foreign Key if exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_zalo_groups_agent_key') THEN
        ALTER TABLE zalo_groups DROP CONSTRAINT fk_zalo_groups_agent_key;
    END IF;
END $$;

-- 2. Drop Index if exists
DROP INDEX IF EXISTS idx_zalo_groups_agent_key;

-- 3. Drop Column if exists
ALTER TABLE zalo_groups DROP COLUMN IF EXISTS agent_key;

-- 4. Verify
SELECT 'zalo_groups agent_key removed' as status;
