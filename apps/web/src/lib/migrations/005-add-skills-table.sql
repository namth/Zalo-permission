-- ============================================
-- MIGRATION 005: ADD SKILLS TABLE
-- Description: Add skills table for user-taught processes.
-- ============================================

CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  logic_config JSONB NOT NULL DEFAULT '{}',
  owner_id UUID, -- Reference to user_profile
  workspace_id UUID, -- Reference to workspaces
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES user_profile(id) ON DELETE SET NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_skills_workspace ON skills(workspace_id);
CREATE INDEX IF NOT EXISTS idx_skills_owner ON skills(owner_id);

-- Optional: Vector extension is likely already enabled, but we can add embedding column if pgvector is available
-- ALTER TABLE skills ADD COLUMN embedding vector(1536);
