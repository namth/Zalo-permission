-- ============================================
-- MIGRATION 009: REMOVE OWNER AND WORKSPACE IDS FROM SKILLS
-- Description: Move relationships entirely to Neo4j
-- ============================================

ALTER TABLE skills 
DROP COLUMN IF EXISTS owner_id,
DROP COLUMN IF EXISTS workspace_id;
