-- PostgreSQL Migration: Tool Groups

-- 1. Create tool_groups table
CREATE TABLE IF NOT EXISTS tool_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tool-to-Group relationship is managed EXCLUSIVELY in Neo4j (BELONGS_TO_GROUP)
-- No longer adding group_id column to tools table in PostgreSQL.
