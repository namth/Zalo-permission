-- ============================================
-- MIGRATION 002d: FIX MISSING ZALO_GROUPS COLUMNS
-- Description: safely adds agent_key and status columns to zalo_groups
-- ============================================

-- 1. Add columns safely using DO block
DO $$
BEGIN
    -- Add agent_key if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='zalo_groups' AND column_name='agent_key') THEN
        ALTER TABLE zalo_groups ADD COLUMN agent_key VARCHAR(100);
    END IF;

    -- Add status if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='zalo_groups' AND column_name='status') THEN
        ALTER TABLE zalo_groups ADD COLUMN status VARCHAR(50) DEFAULT 'active';
    END IF;
END $$;

-- 2. Create indexes (IF NOT EXISTS is supported)
CREATE INDEX IF NOT EXISTS idx_zalo_groups_agent_key ON zalo_groups(agent_key);
CREATE INDEX IF NOT EXISTS idx_zalo_groups_status ON zalo_groups(status);

-- 3. Add FK constraint safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_zalo_groups_agent_key') THEN
        ALTER TABLE zalo_groups ADD CONSTRAINT fk_zalo_groups_agent_key
        FOREIGN KEY (agent_key) REFERENCES agents(key) ON DELETE SET NULL;
    END IF;
END $$;

-- 4. Verify
SELECT 'zalo_groups schema fixed' as status;
