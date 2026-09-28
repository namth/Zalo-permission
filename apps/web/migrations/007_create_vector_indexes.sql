-- Migration 007: Create vector indexes for pgvector
-- Description: Create HNSW indexes on embedding columns for fast similarity search
-- Date: 2026-02-10

-- Create HNSW index on tools embeddings
CREATE INDEX IF NOT EXISTS idx_tools_embedding_hnsw 
ON tools USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 200);

-- Create HNSW index on skills embeddings  
CREATE INDEX IF NOT EXISTS idx_skills_embedding_hnsw
ON skills USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 200);

-- Create HNSW index on user_profiles embeddings (if needed for user similarity)
CREATE INDEX IF NOT EXISTS idx_user_profiles_embedding_hnsw
ON user_profiles USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 200);

-- Add comments
COMMENT ON INDEX idx_tools_embedding_hnsw IS 'HNSW vector index for fast tool semantic search';
COMMENT ON INDEX idx_skills_embedding_hnsw IS 'HNSW vector index for fast skill semantic search';
COMMENT ON INDEX idx_user_profiles_embedding_hnsw IS 'HNSW vector index for user embeddings';
