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
  created_at: Date;
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
 */
export async function addZaloGroup(
  workspace_id: string,
  thread_id: string,
  name?: string,
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
    `INSERT INTO zalo_groups (workspace_id, thread_id, name, created_at)
     VALUES ($1, $2, $3, NOW())
     RETURNING id, workspace_id, thread_id, name, created_at`,
    [workspace_id, thread_id, name || null]
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
    `SELECT id, workspace_id, thread_id, name, created_at
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
    `SELECT id, workspace_id, thread_id, name, created_at
     FROM zalo_groups
     WHERE thread_id = $1`,
    [thread_id]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
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
