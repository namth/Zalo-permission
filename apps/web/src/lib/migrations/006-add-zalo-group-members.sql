-- ============================================
-- MIGRATION 006: ADD ZALO GROUP MEMBERS TABLE
-- Description: Manage users within specific Zalo groups
-- ============================================

CREATE TABLE IF NOT EXISTS zalo_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zalo_group_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role VARCHAR(50) DEFAULT 'MEMBER', -- MEMBER, ADMIN
  status VARCHAR(50) DEFAULT 'active', -- active, blocked, left
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (zalo_group_id) REFERENCES zalo_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE,
  UNIQUE(zalo_group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_zlm_group ON zalo_group_members(zalo_group_id);
CREATE INDEX IF NOT EXISTS idx_zlm_user ON zalo_group_members(user_id);

SELECT 'zalo_group_members table created' as status;
