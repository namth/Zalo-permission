-- Migration 004: Create pending_tasks table
-- Description: Store task state when Planner detects missing input parameters
-- This allows resuming tasks when user provides additional information
-- Date: 2026-02-09

CREATE TABLE IF NOT EXISTS pending_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  thread_id VARCHAR(255) NOT NULL,  -- Zalo thread_id
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  intent TEXT,  -- Original user intent/request
  full_plan JSONB,  -- Complete execution plan from Planner
  missing_parameters JSONB,  -- List of missing parameters: { "step_1_param_A": "description", ... }
  status VARCHAR(50) DEFAULT 'AWAITING_INPUT',  -- AWAITING_INPUT | READY_TO_RESUME | COMPLETED
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT pending_tasks_status_valid CHECK (status IN ('AWAITING_INPUT', 'READY_TO_RESUME', 'COMPLETED')),
  CONSTRAINT pending_tasks_thread_user_unique UNIQUE(thread_id, user_id, workspace_id)
);

-- Create indexes
CREATE INDEX idx_pending_tasks_workspace_id ON pending_tasks (workspace_id);
CREATE INDEX idx_pending_tasks_thread_id ON pending_tasks (thread_id);
CREATE INDEX idx_pending_tasks_user_id ON pending_tasks (user_id);
CREATE INDEX idx_pending_tasks_status ON pending_tasks (status);
CREATE INDEX idx_pending_tasks_created_at ON pending_tasks (created_at);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_pending_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_pending_tasks_updated_at
BEFORE UPDATE ON pending_tasks
FOR EACH ROW
EXECUTE FUNCTION update_pending_tasks_updated_at();

-- Add comments
COMMENT ON TABLE pending_tasks IS 'Stores task state when awaiting user input (mid-execution)';
COMMENT ON COLUMN pending_tasks.thread_id IS 'Zalo group thread_id';
COMMENT ON COLUMN pending_tasks.full_plan IS 'Complete execution plan with steps and parameters';
COMMENT ON COLUMN pending_tasks.missing_parameters IS 'JSON object of missing param keys and descriptions';
COMMENT ON COLUMN pending_tasks.status IS 'AWAITING_INPUT (waiting for user) | READY_TO_RESUME (all info collected) | COMPLETED (task finished)';
