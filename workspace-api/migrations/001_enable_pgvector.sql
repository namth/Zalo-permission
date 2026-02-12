-- Migration 001: Enable pgvector extension
-- Description: Enable pgvector extension for vector similarity search in PostgreSQL
-- Date: 2026-02-09

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
-- SELECT * FROM pg_extension WHERE extname = 'vector';
