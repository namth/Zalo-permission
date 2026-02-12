-- Migration 005: Create audit_logs table
-- Description: Audit trail for all agent actions (Planner, Worker, Observer)
-- Useful for debugging and compliance tracking
-- Date: 2026-02-09

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  thread_id VARCHAR(255),  -- Zalo thread_id (optional)
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  agent_role VARCHAR(50),  -- 'Planner' | 'Worker' | 'Observer'
  action_type VARCHAR(100),  -- 'plan_created', 'plan_updated', 'task_executed', 'result_validated', etc.
  input_data JSONB,  -- Input parameters/request
  output_data JSONB,  -- Output/result
  status VARCHAR(50),  -- 'success' | 'failed' | 'pending'
  error_message TEXT,
  metadata JSONB,  -- Additional context
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT audit_logs_agent_role_valid CHECK (agent_role IN ('Planner', 'Worker', 'Observer')),
  CONSTRAINT audit_logs_status_valid CHECK (status IN ('success', 'failed', 'pending'))
);

-- Create indexes for common queries
CREATE INDEX idx_audit_logs_workspace_id ON audit_logs (workspace_id);
CREATE INDEX idx_audit_logs_thread_id ON audit_logs (thread_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX idx_audit_logs_agent_role ON audit_logs (agent_role);
CREATE INDEX idx_audit_logs_action_type ON audit_logs (action_type);
CREATE INDEX idx_audit_logs_status ON audit_logs (status);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at);

-- Composite index for common query pattern
CREATE INDEX idx_audit_logs_workspace_created ON audit_logs (workspace_id, created_at DESC);
CREATE INDEX idx_audit_logs_thread_created ON audit_logs (thread_id, created_at DESC);

-- Add comments
COMMENT ON TABLE audit_logs IS 'Audit trail of all agent actions for debugging and compliance';
COMMENT ON COLUMN audit_logs.agent_role IS 'Which agent type performed the action';
COMMENT ON COLUMN audit_logs.action_type IS 'Type of action (e.g., plan_created, task_executed, validation_passed)';
COMMENT ON COLUMN audit_logs.input_data IS 'Input parameters/request data';
COMMENT ON COLUMN audit_logs.output_data IS 'Output/result from the action';
COMMENT ON COLUMN audit_logs.status IS 'Result status: success, failed, or pending';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional context/debug information';
