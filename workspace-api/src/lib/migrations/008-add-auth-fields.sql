-- Migration 008: Add Authentication Fields to User Profile
-- Adds username, password_hash, and role for the login system

ALTER TABLE user_profile 
ADD COLUMN IF NOT EXISTS username VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';

-- Set initial role for existing users
UPDATE user_profile SET role = 'user' WHERE role IS NULL;

-- Index for faster login lookups
CREATE INDEX IF NOT EXISTS idx_user_profile_username ON user_profile(username);
