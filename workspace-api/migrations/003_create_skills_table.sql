-- Migration 003: Create skills table
-- Description: Store learned skills (procedures) that users teach to AI
-- Skills are immutable (cannot be edited after creation)
-- Date: 2026-02-09

CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  logic_config JSONB NOT NULL,  -- JSON array of steps: [{ step: 1, tool: "tool_id", params: {...} }, ...]
  owner_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  is_shared BOOLEAN DEFAULT FALSE,  -- true = shared with entire workspace, false = owner only
  embedding vector(1536),  -- OpenAI text-embedding-3-large: 1536 dimensions
  status VARCHAR(50) DEFAULT 'active',  -- active | archived | disabled
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT skills_status_valid CHECK (status IN ('active', 'archived', 'disabled')),
  UNIQUE(workspace_id, name)  -- Skill name must be unique per workspace
);

-- Create indexes
CREATE INDEX idx_skills_owner_id ON skills (owner_id);
CREATE INDEX idx_skills_workspace_id ON skills (workspace_id);
CREATE INDEX idx_skills_is_shared ON skills (is_shared);
CREATE INDEX idx_skills_status ON skills (status);
CREATE INDEX idx_skills_embedding ON skills USING hnsw (embedding vector_cosine_ops);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_skills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_skills_updated_at
BEFORE UPDATE ON skills
FOR EACH ROW
EXECUTE FUNCTION update_skills_updated_at();

-- Add comments
COMMENT ON TABLE skills IS 'Stores learned skills (procedures) - immutable after creation';
COMMENT ON COLUMN skills.logic_config IS 'JSON array of execution steps';
COMMENT ON COLUMN skills.is_shared IS 'If true, accessible to all workspace members; if false, owner only';
COMMENT ON COLUMN skills.embedding IS 'Vector embedding for semantic search (OpenAI: 1536 dims)';
