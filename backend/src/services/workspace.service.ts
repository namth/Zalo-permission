import { query } from '@/lib/db';
import { executeQuery } from '@/lib/db';
import { logAuditAction } from './audit.service';
import { getUserById } from './user.service';

/**
 * Workspace Type
 */
export interface Workspace {
  id: string;
  name: string;
  status: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Zalo Group Type
 */
export interface ZaloGroup {
  id: string;
  workspace_id: string;
  thread_id: string;
  name?: string;
  agent_key?: string;  // [NEW] Direct agent link
  created_at: Date;
  updated_at?: Date;
}

/**
 * Create workspace
 */
export async function createWorkspace(
  name: string,
  description?: string,
  created_by?: string
): Promise<Workspace> {
  const result = await query(
    `INSERT INTO workspaces (name, description, status, created_at, updated_at)
     VALUES ($1, $2, 'active', NOW(), NOW())
     RETURNING id, name, status, description, created_at, updated_at`,
    [name, description || null]
  );

  if (result.rows.length === 0) {
    throw new Error('Failed to create workspace');
  }

  const workspace = result.rows[0];

  // Create in Neo4j
  try {
    await executeQuery(
      `CREATE (w:Workspace {id: $id, name: $name, created_at: datetime()})
       RETURN w`,
      {
        id: workspace.id,
        name: workspace.name
      }
    );
  } catch (error) {
    console.error('Failed to create workspace in Neo4j:', error);
  }

  // Log audit
  await logAuditAction(workspace.id, created_by || null, 'CREATE_WORKSPACE', 'Workspace', workspace.id, null, workspace);

  return workspace;
}

/**
 * Get workspace by ID
 */
export async function getWorkspace(id: string): Promise<Workspace | null> {
  const result = await query(
    `SELECT id, name, status, description, created_at, updated_at
     FROM workspaces
     WHERE id = $1`,
    [id]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * List all workspaces
 */
export async function listWorkspaces(
  limit: number = 100,
  offset: number = 0
): Promise<{ workspaces: Workspace[]; total: number }> {
  const countResult = await query('SELECT COUNT(*) as count FROM workspaces');
  const total = countResult.rows[0].count;

  const result = await query(
    `SELECT id, name, status, description, created_at, updated_at
     FROM workspaces
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return { workspaces: result.rows, total };
}

/**
 * Update workspace
 */
export async function updateWorkspace(
  id: string,
  updates: Partial<Omit<Workspace, 'id' | 'created_at' | 'updated_at'>>,
  updated_by?: string
): Promise<Workspace> {
  const old = await getWorkspace(id);
  if (!old) {
    throw new Error(`Workspace not found: ${id}`);
  }

  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.status !== undefined) {
    fields.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    values.push(updates.description);
  }

  if (fields.length === 0) {
    return old;
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE workspaces
     SET ${fields.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING id, name, status, description, created_at, updated_at`,
    values
  );

  if (result.rows.length === 0) {
    throw new Error(`Workspace not found: ${id}`);
  }

  const updated = result.rows[0];

  // Update in Neo4j
  try {
    await executeQuery(
      `MATCH (w:Workspace {id: $id})
       SET w.name = $name
       RETURN w`,
      { id, name: updated.name }
    );
  } catch (error) {
    console.error('Failed to update workspace in Neo4j:', error);
  }

  await logAuditAction(id, updated_by || null, 'UPDATE_WORKSPACE', 'Workspace', id, old, updated);

  return updated;
}

/**
 * Delete workspace
 */
export async function deleteWorkspace(id: string, deleted_by?: string): Promise<void> {
  const workspace = await getWorkspace(id);
  if (!workspace) {
    throw new Error(`Workspace not found: ${id}`);
  }

  // Delete from PostgreSQL (cascades will remove related data)
  await query('DELETE FROM workspaces WHERE id = $1', [id]);

  // Delete from Neo4j
  try {
    await executeQuery(
      `MATCH (w:Workspace {id: $id})
       DETACH DELETE w`,
      { id }
    );
  } catch (error) {
    console.error('Failed to delete workspace from Neo4j:', error);
  }

  await logAuditAction(id, deleted_by || null, 'DELETE_WORKSPACE', 'Workspace', id, workspace, null);
}

/**
 * Add Zalo Group to Workspace
 * @param agent_key - [NEW] The agent to assign to this group
 */
export async function addZaloGroup(
  workspace_id: string,
  thread_id: string,
  name?: string,
  agent_key?: string,
  created_by?: string
): Promise<ZaloGroup> {
  // Check if group already exists with different workspace
  const existing = await query(
    `SELECT id, workspace_id FROM zalo_groups WHERE thread_id = $1`,
    [thread_id]
  );

  if (existing.rows.length > 0) {
    throw new Error(`Zalo group ${thread_id} already belongs to another workspace`);
  }

  const result = await query(
    `INSERT INTO zalo_groups (workspace_id, thread_id, name, agent_key, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     RETURNING id, workspace_id, thread_id, name, agent_key, created_at, updated_at`,
    [workspace_id, thread_id, name || null, agent_key || null]
  );

  if (result.rows.length === 0) {
    throw new Error('Failed to add zalo group');
  }

  const group = result.rows[0];

  // Create in Neo4j
  try {
    await executeQuery(
      `MATCH (w:Workspace {id: $workspace_id})
       MERGE (g:ZaloGroup {id: $id, thread_id: $thread_id})
       SET g.name = $name, g.created_at = datetime()
       MERGE (g)-[:BELONGS_TO]->(w)
       RETURN g`,
      {
        workspace_id,
        id: group.id,
        thread_id: group.thread_id,
        name: group.name
      }
    );
  } catch (error) {
    console.error('Failed to add zalo group to Neo4j:', error);
  }

  await logAuditAction(workspace_id, created_by || null, 'ADD_ZALO_GROUP', 'ZaloGroup', group.id, null, group);

  return group;
}

/**
 * Get Zalo Groups in Workspace
 */
export async function getWorkspaceZaloGroups(
  workspace_id: string,
  limit: number = 100,
  offset: number = 0
): Promise<{ groups: ZaloGroup[]; total: number }> {
  const countResult = await query(
    `SELECT COUNT(*) as count FROM zalo_groups WHERE workspace_id = $1`,
    [workspace_id]
  );

  const total = countResult.rows[0].count;

  const result = await query(
    `SELECT id, workspace_id, thread_id, name, agent_key, created_at, updated_at
     FROM zalo_groups
     WHERE workspace_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [workspace_id, limit, offset]
  );

  return { groups: result.rows, total };
}

/**
 * Remove Zalo Group from Workspace
 */
export async function removeZaloGroup(
  workspace_id: string,
  group_id: string,
  removed_by?: string
): Promise<void> {
  // Get group info
  const result = await query(
    `SELECT id, thread_id FROM zalo_groups WHERE id = $1 AND workspace_id = $2`,
    [group_id, workspace_id]
  );

  if (result.rows.length === 0) {
    throw new Error('Zalo group not found');
  }

  const group = result.rows[0];

  // Delete from PostgreSQL
  await query('DELETE FROM zalo_groups WHERE id = $1', [group_id]);

  // Delete from Neo4j
  try {
    await executeQuery(
      `MATCH (g:ZaloGroup {id: $id})
       DETACH DELETE g`,
      { id: group_id }
    );
  } catch (error) {
    console.error('Failed to remove zalo group from Neo4j:', error);
  }

  await logAuditAction(workspace_id, removed_by || null, 'REMOVE_ZALO_GROUP', 'ZaloGroup', group_id, group, null);
}

/**
 * Get Zalo Group by thread_id
 */
export async function getZaloGroupByThreadId(thread_id: string): Promise<ZaloGroup | null> {
  const result = await query(
    `SELECT id, workspace_id, thread_id, name, agent_key, status, created_at, updated_at
     FROM zalo_groups
     WHERE thread_id = $1`,
    [thread_id]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * [NEW] Update agent for Zalo Group
 */
export async function updateZaloGroupAgent(
  group_id: string,
  agent_key: string,
  updated_by?: string
): Promise<ZaloGroup> {
  const group = await query(
    `SELECT id, workspace_id, thread_id, name, agent_key, status, created_at, updated_at
     FROM zalo_groups
     WHERE id = $1`,
    [group_id]
  );

  if (group.rows.length === 0) {
    throw new Error('Zalo group not found');
  }

  const result = await query(
    `UPDATE zalo_groups
     SET agent_key = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, workspace_id, thread_id, name, agent_key, status, created_at, updated_at`,
    [agent_key, group_id]
  );

  if (result.rows.length === 0) {
    throw new Error('Failed to update zalo group agent');
  }

  const updated = result.rows[0];
  const old = group.rows[0];

  // Update in Neo4j - create/update USES_AGENT relationship
  try {
    await executeQuery(
      `MATCH (g:ZaloGroup {id: $group_id})
       OPTIONAL MATCH (g)-[r:USES_AGENT]->(oldAgent:Agent)
       DELETE r
       WITH g
       MATCH (a:Agent {key: $agent_key})
       CREATE (g)-[:USES_AGENT]->(a)
       RETURN g, a`,
      {
        group_id,
        agent_key
      }
    );
  } catch (error) {
    console.error('Failed to update zalo group agent in Neo4j:', error);
  }

  await logAuditAction(
    old.workspace_id,
    updated_by || null,
    'UPDATE_ZALO_GROUP_AGENT',
    'ZaloGroup',
    group_id,
    { agent_key: old.agent_key },
    { agent_key: updated.agent_key }
  );

  return updated;
}

/**
 * Assign user role in workspace
 */
export async function assignUserRole(
  workspace_id: string,
  user_id: string,
  role: string,
  assigned_by?: string
): Promise<any> {
  // Validate role
  const validRoles = ['ADMIN', 'MEMBER'];
  if (!validRoles.includes(role)) {
    throw new Error(`Invalid role: ${role}`);
  }

  // Check if user already has role
  const existing = await query(
    `SELECT id FROM workspace_user_roles WHERE workspace_id = $1 AND user_id = $2`,
    [workspace_id, user_id]
  );

  if (existing.rows.length > 0) {
    // Update existing role
    const result = await query(
      `UPDATE workspace_user_roles
       SET role = $1, assigned_by = $2, updated_at = NOW()
       WHERE workspace_id = $3 AND user_id = $4
       RETURNING id, workspace_id, user_id, role, assigned_by, created_at, updated_at`,
      [role, assigned_by || null, workspace_id, user_id]
    );

    const userRole = result.rows[0];
    await logAuditAction(workspace_id, assigned_by || null, 'UPDATE_USER_ROLE', 'UserRole', user_id, { role: role === 'ADMIN' ? 'MEMBER' : 'ADMIN' }, userRole);
    return userRole;
  }

  // Create new role assignment
  const result = await query(
    `INSERT INTO workspace_user_roles (workspace_id, user_id, role, assigned_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     RETURNING id, workspace_id, user_id, role, assigned_by, created_at, updated_at`,
    [workspace_id, user_id, role, assigned_by || null]
  );

  if (result.rows.length === 0) {
    throw new Error('Failed to assign user role');
  }

  const userRole = result.rows[0];

  // Update in Neo4j
  try {
    await executeQuery(
      `MATCH (u:User {id: $user_id})
       MATCH (w:Workspace {id: $workspace_id})
       MERGE (u)-[r:HAS_ROLE]->(w)
       SET r.role = $role
       RETURN r`,
      { user_id, workspace_id, role }
    );
  } catch (error) {
    console.error('Failed to assign role in Neo4j:', error);
  }

  await logAuditAction(workspace_id, assigned_by || null, 'ASSIGN_USER_ROLE', 'UserRole', user_id, null, userRole);

  return userRole;
}

/**
 * Remove user from workspace
 */
export async function removeUserFromWorkspace(
  workspace_id: string,
  user_id: string,
  removed_by?: string
): Promise<void> {
  // Delete from PostgreSQL
  await query(
    'DELETE FROM workspace_user_roles WHERE workspace_id = $1 AND user_id = $2',
    [workspace_id, user_id]
  );

  // Delete from Neo4j
  try {
    await executeQuery(
      `MATCH (u:User {id: $user_id})-[r:HAS_ROLE]->(w:Workspace {id: $workspace_id})
        DELETE r`,
      { user_id, workspace_id }
    );
  } catch (error) {
    console.error('Failed to remove user role from Neo4j:', error);
  }

  await logAuditAction(workspace_id, removed_by || null, 'REMOVE_USER_FROM_WORKSPACE', 'User', user_id, null, null);
}

/**
 * Search workspaces by name using trigram similarity
 * Returns results sorted by similarity score (descending)
 */
export async function searchWorkspacesByName(
  name: string,
  limit: number = 20,
  similarity_threshold: number = 0.3
): Promise<{ workspaces: (Workspace & { similarity: number })[]; total: number }> {
  // Validate input
  if (!name || name.trim().length === 0) {
    return { workspaces: [], total: 0 };
  }

  try {
    // Enable pg_trgm extension if not already enabled
    await query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    // Search using trigram similarity
    const result = await query(
      `SELECT 
        id, 
        name, 
        status, 
        description, 
        created_at, 
        updated_at,
        similarity(name, $1) as similarity
      FROM workspaces
      WHERE similarity(name, $1) > $2
      ORDER BY similarity DESC
      LIMIT $3`,
      [name, similarity_threshold, limit]
    );

    // Get total count of matching results (without limit)
    const countResult = await query(
      `SELECT COUNT(*) as count
       FROM workspaces
       WHERE similarity(name, $1) > $2`,
      [name, similarity_threshold]
    );

    return {
      workspaces: result.rows,
      total: parseInt(countResult.rows[0].count)
    };
  } catch (error) {
    console.error('Error searching workspaces by name:', error);
    // Fallback to LIKE search if trigram fails
    return fallbackWorkspaceSearch(name, limit);
  }
}

/**
 * Fallback search using LIKE (if pg_trgm not available)
 */
async function fallbackWorkspaceSearch(
  name: string,
  limit: number = 20
): Promise<{ workspaces: (Workspace & { similarity: number })[]; total: number }> {
  const searchTerm = `%${name}%`;

  const result = await query(
    `SELECT 
      id, 
      name, 
      status, 
      description, 
      created_at, 
      updated_at,
      CASE 
        WHEN name ILIKE $1 THEN 1.0
        WHEN name ILIKE $2 THEN 0.8
        ELSE 0.5
      END as similarity
    FROM workspaces
    WHERE name ILIKE $1 OR name ILIKE $2
    ORDER BY similarity DESC
    LIMIT $3`,
    [searchTerm, `${name}%`, limit]
  );

  const countResult = await query(
    `SELECT COUNT(*) as count FROM workspaces
     WHERE name ILIKE $1 OR name ILIKE $2`,
    [searchTerm, `${name}%`]
  );

  return {
    workspaces: result.rows,
    total: parseInt(countResult.rows[0].count)
  };
}
