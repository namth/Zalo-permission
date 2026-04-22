-- ============================================
-- MIGRATION 007: UPDATE SKILLS TABLE
-- Description: Drop logic_config and add detail column for markdown prompt
-- ============================================

ALTER TABLE skills 
DROP COLUMN IF EXISTS logic_config,
ADD COLUMN IF NOT EXISTS detail TEXT;
