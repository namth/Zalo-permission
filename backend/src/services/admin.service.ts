import { executeQuery } from '@/lib/neo4j';
import { query } from '@/lib/db';
import {
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  WorkspaceListItem,
  WorkspaceDetailResponse,
} from '@/types';

/**
 * Create new workspace (Neo4j + PostgreSQL)
 */
export async function createWorkspaceAdmin(
  req: CreateWorkspaceRequest
): Promise<WorkspaceDetailResponse> {
  const {
    workspace_id,
    name,
    type = 'team',
    agent_key = 'agent_support',
    system_prompt,
  } = req;

  // Validate inputs
  if (!workspace_id || !name || !system_prompt) {
    throw new Error('Missing required fields: workspace_id, name, system_prompt');
  }

  try {
    // 0. Check if workspace already exists
    const checkResult = await executeQuery(
      `MATCH (w:Workspace {id: $workspace_id})
       RETURN w`,
      { workspace_id }
    );

    if (checkResult.records.length > 0) {
      throw new Error(`Workspace with ID '${workspace_id}' already exists`);
    }

    // 1. Create Workspace in Neo4j
    const workspaceResult = await executeQuery(
      `CREATE (w:Workspace {
        id: $workspace_id,
        name: $name,
        type: $type,
        created_at: datetime()
      })
      RETURN w { .id, .name, .type, .created_at } as workspace`,
      { workspace_id, name, type }
    );

    if (workspaceResult.records.length === 0) {
      throw new Error('Failed to create workspace in Neo4j');
    }

    // 2. Create or merge Agent in Neo4j
    await executeQuery(
      `MERGE (a:Agent {key: $agent_key})
       SET a.type = 'ai_agent'
       RETURN a`,
      { agent_key }
    );

    // 3. Link Workspace -> Agent (USES)
    await executeQuery(
      `MATCH (w:Workspace {id: $workspace_id})
       MATCH (a:Agent {key: $agent_key})
       MERGE (w)-[:USES]->(a)
       RETURN true`,
      { workspace_id, agent_key }
    );

    // 4. Create workspace config in PostgreSQL
    let configResult;
    try {
      configResult = await query(
        `INSERT INTO workspace_config (workspace_id, default_agent, system_prompt, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING id, workspace_id, default_agent, system_prompt, status, created_at, updated_at`,
        [workspace_id, agent_key, system_prompt, 'active']
      );
    } catch (pgError: any) {
      console.error('PostgreSQL Error:', pgError.message);
      console.error('Query details:', {
        workspace_id,
        agent_key,
        system_prompt: system_prompt.substring(0, 50) + '...',
      });
      throw new Error(`Failed to create workspace config in PostgreSQL: ${pgError.message}`);
    }

    if (configResult.rows.length === 0) {
      throw new Error('Failed to create workspace config in PostgreSQL');
    }

    const config = configResult.rows[0];
    const workspace = workspaceResult.records[0].get('workspace');

    return {
      id: workspace.id,
      name: workspace.name,
      type: workspace.type,
      agent_key,
      system_prompt: config.system_prompt,
      status: config.status,
      created_at: workspace.created_at,
      updated_at: config.updated_at,
      member_count: 0,
    };
  } catch (error) {
    console.error('Error creating workspace:', error);
    throw error;
  }
}

/**
 * Get all workspaces
 */
export async function getAllWorkspaces(): Promise<WorkspaceListItem[]> {
  try {
    // Get all workspaces from Neo4j
    const neo4jResult = await executeQuery(
      `MATCH (w:Workspace)
       OPTIONAL MATCH (w)-[:USES]->(a:Agent)
       RETURN w { .id, .name, .type, .created_at } as workspace, a.key as agent_key`
    );

    if (neo4jResult.records.length === 0) {
      return [];
    }

    // Get configs from PostgreSQL
    const pgResult = await query(
      `SELECT workspace_id, status FROM workspace_config`
    );

    const configMap = new Map();
    pgResult.rows.forEach((row) => {
      configMap.set(row.workspace_id, row.status);
    });

    // Combine results
    return neo4jResult.records.map((record) => {
      const workspace = record.get('workspace');
      const agent_key = record.get('agent_key') || 'agent_support';
      const status = configMap.get(workspace.id) || 'active';

      return {
        id: workspace.id,
        name: workspace.name,
        type: workspace.type,
        agent_key,
        status,
        created_at: workspace.created_at,
      };
    });
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    throw error;
  }
}

/**
 * Get workspace detail by ID
 */
export async function getWorkspaceDetail(
  workspace_id: string
): Promise<WorkspaceDetailResponse | null> {
  try {
    // Get workspace + agent from Neo4j
    const neo4jResult = await executeQuery(
      `MATCH (w:Workspace {id: $workspace_id})
       OPTIONAL MATCH (w)-[:USES]->(a:Agent)
       OPTIONAL MATCH (u:ZaloUser)-[:MEMBER_OF]->(w)
       RETURN 
         w { .id, .name, .type, .created_at } as workspace,
         a.key as agent_key,
         COUNT(u) as member_count`,
      { workspace_id }
    );

    if (neo4jResult.records.length === 0) {
      return null;
    }

    const record = neo4jResult.records[0];
    const workspace = record.get('workspace');
    const agent_key = record.get('agent_key') || 'agent_support';
    const member_count = record.get('member_count')?.low || 0;

    // Get config from PostgreSQL
    const pgResult = await query(
      `SELECT id, workspace_id, default_agent, system_prompt, status, created_at, updated_at
       FROM workspace_config
       WHERE workspace_id = $1`,
      [workspace_id]
    );

    if (pgResult.rows.length === 0) {
      return null;
    }

    const config = pgResult.rows[0];

    return {
      id: workspace.id,
      name: workspace.name,
      type: workspace.type,
      agent_key,
      system_prompt: config.system_prompt,
      status: config.status,
      created_at: workspace.created_at,
      updated_at: config.updated_at,
      member_count,
    };
  } catch (error) {
    console.error('Error fetching workspace detail:', error);
    throw error;
  }
}

/**
 * Update workspace
 */
export async function updateWorkspaceAdmin(
  workspace_id: string,
  req: UpdateWorkspaceRequest
): Promise<WorkspaceDetailResponse> {
  const { name, type, agent_key, system_prompt, status } = req;

  try {
    // Check if workspace exists
    const existsResult = await executeQuery(
      `MATCH (w:Workspace {id: $workspace_id})
       RETURN w`,
      { workspace_id }
    );

    if (existsResult.records.length === 0) {
      throw new Error('Workspace not found');
    }

    // Update Neo4j
    if (name || type) {
      const updateFields = [];
      const params: any = { workspace_id };

      if (name) {
        updateFields.push('w.name = $name');
        params.name = name;
      }
      if (type) {
        updateFields.push('w.type = $type');
        params.type = type;
      }

      await executeQuery(
        `MATCH (w:Workspace {id: $workspace_id})
         SET ${updateFields.join(', ')}
         RETURN w`,
        params
      );
    }

    // Update agent relationship if provided
    if (agent_key) {
      // Create/merge agent
      await executeQuery(
        `MERGE (a:Agent {key: $agent_key})
         SET a.type = 'ai_agent'
         RETURN a`,
        { agent_key }
      );

      // Remove old USES relationship and create new one
      await executeQuery(
        `MATCH (w:Workspace {id: $workspace_id})-[old:USES]->()
         DELETE old`,
        { workspace_id }
      );

      await executeQuery(
        `MATCH (w:Workspace {id: $workspace_id})
         MATCH (a:Agent {key: $agent_key})
         MERGE (w)-[:USES]->(a)
         RETURN true`,
        { workspace_id, agent_key }
      );
    }

    // Update PostgreSQL config
    if (system_prompt || status) {
      const updateFields = [];
      const params: any = [workspace_id];
      let paramIndex = 2;

      if (system_prompt) {
        updateFields.push(`system_prompt = $${paramIndex}`);
        params.push(system_prompt);
        paramIndex++;
      }
      if (status) {
        updateFields.push(`status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      updateFields.push(`updated_at = NOW()`);

      await query(
        `UPDATE workspace_config
         SET ${updateFields.join(', ')}
         WHERE workspace_id = $1`,
        params
      );
    }

    // Return updated workspace
    const detail = await getWorkspaceDetail(workspace_id);
    if (!detail) {
      throw new Error('Failed to retrieve updated workspace');
    }

    return detail;
  } catch (error) {
    console.error('Error updating workspace:', error);
    throw error;
  }
}

/**
 * Delete workspace
 */
export async function deleteWorkspaceAdmin(workspace_id: string): Promise<void> {
  try {
    // Check if workspace exists
    const existsResult = await executeQuery(
      `MATCH (w:Workspace {id: $workspace_id})
       RETURN w`,
      { workspace_id }
    );

    if (existsResult.records.length === 0) {
      throw new Error('Workspace not found');
    }

    // Delete from Neo4j (all relationships)
    await executeQuery(
      `MATCH (w:Workspace {id: $workspace_id})
       DETACH DELETE w`,
      { workspace_id }
    );

    // Delete from PostgreSQL
    await query(
      `DELETE FROM workspace_config WHERE workspace_id = $1`,
      [workspace_id]
    );

    console.log(`Workspace ${workspace_id} deleted successfully`);
  } catch (error) {
    console.error('Error deleting workspace:', error);
    throw error;
  }
}
