-- Migration 010: Add output_schema column to tools table
-- Description: Add output_schema column to store JSON schema for tool return values
-- Date: 2026-04-19

ALTER TABLE tools ADD COLUMN IF NOT EXISTS output_schema JSONB;

COMMENT ON COLUMN tools.output_schema IS 'JSON schema for tool return values';
