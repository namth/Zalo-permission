-- Migration 002: Create tools table
-- Description: Store API tools/integrations with vector embeddings for semantic search
-- Date: 2026-02-09

CREATE TABLE IF NOT EXISTS tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  input_schema JSONB,  -- JSON schema for tool input parameters
  embedding vector(1536),  -- OpenAI text-embedding-3-large: 1536 dimensions
  status VARCHAR(50) DEFAULT 'active',  -- active | deprecated | disabled
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT tools_key_format CHECK (key ~ '^[a-z0-9_]+$'),
  CONSTRAINT tools_status_valid CHECK (status IN ('active', 'deprecated', 'disabled'))
);

-- Create indexes
CREATE INDEX idx_tools_key ON tools (key);
CREATE INDEX idx_tools_status ON tools (status);
CREATE INDEX idx_tools_embedding ON tools USING hnsw (embedding vector_cosine_ops);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_tools_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tools_updated_at
BEFORE UPDATE ON tools
FOR EACH ROW
EXECUTE FUNCTION update_tools_updated_at();

-- Add comment
COMMENT ON TABLE tools IS 'Stores API tools/integrations that can be used by agents';
COMMENT ON COLUMN tools.embedding IS 'Vector embedding for semantic search (OpenAI: 1536 dims)';
