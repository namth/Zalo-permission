import { query } from '@/lib/db';
import { executeQuery } from '@/lib/neo4j';
import { logAuditAction } from './audit.service';

/**
 * Agent Type
 */
export interface Agent {
  key: string;
  name: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Workspace Agent Config Type
 */
export interface WorkspaceAgentConfig {
  id: string;
  workspace_id: string;
  agent_key: string;
  system_prompt?: string;
  temperature: number;
  max_tokens: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Create agent (global)
 */
export async function createAgent(
  key: string,
  name: string,
  description?: string,
  created_by?: string
): Promise<Agent> {
  const result = await query(
    `INSERT INTO agents (key, name, description, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     RETURNING key, name, description, created_at, updated_at`,
    [key, name, description || null]
  );

  if (result.rows.length === 0) {
    throw new Error('Failed to create agent');
  }

  const agent = result.rows[0];

  // Create in Neo4j
  try {
    await executeQuery(
      `MERGE (a:Agent {key: $key})
       SET a.name = $name, a.created_at = datetime()
       RETURN a`,
      {
        key: agent.key,
        name: agent.name
      }
    );
  } catch (error) {
    console.error('Failed to create agent in Neo4j:', error);
  }

  await logAuditAction(null, created_by || null, 'CREATE_AGENT', 'Agent', key, null, agent);

  return agent;
}

/**
 * Get agent by key
 */
export async function getAgent(key: string): Promise<Agent | null> {
  const result = await query(
    `SELECT key, name, description, created_at, updated_at
     FROM agents
     WHERE key = $1`,
    [key]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * List all agents
 */
export async function listAgents(limit: number = 100, offset: number = 0): Promise<{ agents: Agent[]; total: number }> {
  const countResult = await query('SELECT COUNT(*) as count FROM agents');
  const total = countResult.rows[0].count;

  const result = await query(
    `SELECT key, name, description, created_at, updated_at
     FROM agents
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return { agents: result.rows, total };
}

/**
 * Update agent
 */
export async function updateAgent(
  key: string,
  updates: Partial<Omit<Agent, 'key' | 'created_at' | 'updated_at'>>,
  updated_by?: string
): Promise<Agent> {
  const old = await getAgent(key);
  if (!old) {
    throw new Error(`Agent not found: ${key}`);
  }

  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    values.push(updates.description);
  }

  if (fields.length === 0) {
    return old;
  }

  fields.push(`updated_at = NOW()`);
  values.push(key);

  const result = await query(
    `UPDATE agents
     SET ${fields.join(', ')}
     WHERE key = $${paramIndex}
     RETURNING key, name, description, created_at, updated_at`,
    values
  );

  if (result.rows.length === 0) {
    throw new Error(`Agent not found: ${key}`);
  }

  const updated = result.rows[0];

  try {
    await executeQuery(
      `MATCH (a:Agent {key: $key})
       SET a.name = $name
       RETURN a`,
      { key, name: updated.name }
    );
  } catch (error) {
    console.error('Failed to update agent in Neo4j:', error);
  }

  await logAuditAction(null, updated_by || null, 'UPDATE_AGENT', 'Agent', key, old, updated);

  return updated;
}

/**
 * Delete agent
 */
export async function deleteAgent(key: string, deleted_by?: string): Promise<void> {
  const agent = await getAgent(key);
  if (!agent) {
    throw new Error(`Agent not found: ${key}`);
  }

  // Check if agent is used in any workspace
  const used = await query(
    `SELECT COUNT(*) as count FROM workspace_agent_config WHERE agent_key = $1`,
    [key]
  );

  if (used.rows[0].count > 0) {
    throw new Error(`Agent ${key} is used in workspaces, cannot delete`);
  }

  // Delete from PostgreSQL
  await query('DELETE FROM agents WHERE key = $1', [key]);

  // Delete from Neo4j
  try {
    await executeQuery(
      `MATCH (a:Agent {key: $key})
       DETACH DELETE a`,
      { key }
    );
  } catch (error) {
    console.error('Failed to delete agent from Neo4j:', error);
  }

  await logAuditAction(null, deleted_by || null, 'DELETE_AGENT', 'Agent', key, agent, null);
}

/**
 * Assign agent to workspace with config
 */
export async function assignAgentToWorkspace(
  workspace_id: string,
  agent_key: string,
  system_prompt?: string,
  temperature: number = 0.7,
  max_tokens: number = 2000,
  assigned_by?: string
): Promise<WorkspaceAgentConfig> {
  // Check if agent exists
  const agent = await getAgent(agent_key);
  if (!agent) {
    throw new Error(`Agent not found: ${agent_key}`);
  }

  // Check if already assigned
  const existing = await query(
    `SELECT id FROM workspace_agent_config WHERE workspace_id = $1 AND agent_key = $2`,
    [workspace_id, agent_key]
  );

  if (existing.rows.length > 0) {
    throw new Error(`Agent ${agent_key} already assigned to this workspace`);
  }

  const result = await query(
    `INSERT INTO workspace_agent_config (workspace_id, agent_key, system_prompt, temperature, max_tokens, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     RETURNING id, workspace_id, agent_key, system_prompt, temperature, max_tokens, created_at, updated_at`,
    [workspace_id, agent_key, system_prompt || null, temperature, max_tokens]
  );

  if (result.rows.length === 0) {
    throw new Error('Failed to assign agent to workspace');
  }

  const config = result.rows[0];

  // Create relationship in Neo4j
  try {
    await executeQuery(
      `MATCH (w:Workspace {id: $workspace_id})
       MATCH (a:Agent {key: $agent_key})
       MERGE (w)-[r:USES_AGENT]->(a)
       RETURN r`,
      { workspace_id, agent_key }
    );
  } catch (error) {
    console.error('Failed to assign agent in Neo4j:', error);
  }

  await logAuditAction(workspace_id, assigned_by || null, 'ASSIGN_AGENT', 'Agent', agent_key, null, config);

  return config;
}

/**
 * Get agent config for workspace
 */
export async function getWorkspaceAgentConfig(
  workspace_id: string,
  agent_key?: string
): Promise<WorkspaceAgentConfig | null> {
  let query_str = `SELECT id, workspace_id, agent_key, system_prompt, temperature, max_tokens, created_at, updated_at
                  FROM workspace_agent_config
                  WHERE workspace_id = $1`;
  const params = [workspace_id];

  if (agent_key) {
    query_str += ` AND agent_key = $2`;
    params.push(agent_key);
  } else {
    query_str += ` LIMIT 1`;
  }

  const result = await query(query_str, params);

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Get all agent configs for workspace
 */
export async function getWorkspaceAgentConfigs(workspace_id: string): Promise<WorkspaceAgentConfig[]> {
  const result = await query(
    `SELECT id, workspace_id, agent_key, system_prompt, temperature, max_tokens, created_at, updated_at
     FROM workspace_agent_config
     WHERE workspace_id = $1
     ORDER BY created_at DESC`,
    [workspace_id]
  );

  return result.rows;
}

/**
 * Update agent config
 */
export async function updateAgentConfig(
  config_id: string,
  updates: Partial<Omit<WorkspaceAgentConfig, 'id' | 'workspace_id' | 'agent_key' | 'created_at' | 'updated_at'>>,
  updated_by?: string
): Promise<WorkspaceAgentConfig> {
  // Get old config
  const old = await query(
    `SELECT id, workspace_id, agent_key, system_prompt, temperature, max_tokens, created_at, updated_at
     FROM workspace_agent_config
     WHERE id = $1`,
    [config_id]
  );

  if (old.rows.length === 0) {
    throw new Error('Agent config not found');
  }

  const oldConfig = old.rows[0];

  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.system_prompt !== undefined) {
    fields.push(`system_prompt = $${paramIndex++}`);
    values.push(updates.system_prompt);
  }
  if (updates.temperature !== undefined) {
    fields.push(`temperature = $${paramIndex++}`);
    values.push(updates.temperature);
  }
  if (updates.max_tokens !== undefined) {
    fields.push(`max_tokens = $${paramIndex++}`);
    values.push(updates.max_tokens);
  }

  if (fields.length === 0) {
    return oldConfig;
  }

  fields.push(`updated_at = NOW()`);
  values.push(config_id);

  const result = await query(
    `UPDATE workspace_agent_config
     SET ${fields.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING id, workspace_id, agent_key, system_prompt, temperature, max_tokens, created_at, updated_at`,
    values
  );

  if (result.rows.length === 0) {
    throw new Error('Failed to update agent config');
  }

  const updatedConfig = result.rows[0];

  await logAuditAction(
    updatedConfig.workspace_id,
    updated_by || null,
    'UPDATE_AGENT_CONFIG',
    'AgentConfig',
    config_id,
    oldConfig,
    updatedConfig
  );

  return updatedConfig;
}
