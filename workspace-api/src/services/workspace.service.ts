
import { query } from '@/lib/db';
import { executeQuery } from '@/lib/db';
import neo4j from 'neo4j-driver';
import { logAuditAction } from './audit.service';
import { UserService } from './user.service';

/**
 * Serialize Date objects to ISO strings for JSON compatibility
 */
function serializeRow<T extends Record<string, any>>(row: T): T {
  const serialized: any = { ...row };
  Object.keys(serialized).forEach(key => {
    if (serialized[key] instanceof Date) {
      serialized[key] = serialized[key].toISOString();
    }
  });
  return serialized;
}

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
  status?: string;
  created_at: Date | string;
  updated_at?: Date | string;
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

  const workspace = serializeRow(result.rows[0]);

  // Create in Neo4j
  try {
    await executeQuery(
      `CREATE (w:Workspace {id: $id, name: $name})
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
  await logAuditAction(
    workspace.id,
    null,  // thread_id
    created_by || null,  // user_id
    'CREATE_WORKSPACE',  // action_type
    null,  // input_data
    workspace  // output_data
  );

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

  return result.rows.length > 0 ? serializeRow(result.rows[0]) : null;
}

/**
 * List all workspaces
 */
export async function listWorkspaces(
  limit: number = 100,
  offset: number = 0,
  filterByUserId?: string
): Promise<{ workspaces: Workspace[]; total: number }> {
  let workspaceIds: string[] | null = null;

  // If filtering by user, get workspace IDs from Neo4j
  if (filterByUserId) {
    const neo4jResult = await executeQuery(
      `MATCH (u:ZaloUser {id: $user_id})-[:PART_OF]->(w:Workspace)
       RETURN w.id AS id`,
      { user_id: filterByUserId }
    );
    workspaceIds = neo4jResult.records.map(r => r.get('id'));
    
    if (workspaceIds.length === 0) {
      return { workspaces: [], total: 0 };
    }
  }

  let countQuery = 'SELECT COUNT(*) as count FROM workspaces';
  let listQuery = `SELECT id, name, status, description, created_at, updated_at FROM workspaces`;
  const params: any[] = [];

  if (workspaceIds) {
    countQuery += ' WHERE id = ANY($1)';
    listQuery += ' WHERE id = ANY($1)';
    params.push(workspaceIds);
  }

  const countResult = await query(countQuery, params);
  const total = parseInt(countResult.rows[0].count, 10);

  const limitParamIndex = params.length + 1;
  const offsetParamIndex = params.length + 2;
  listQuery += ` ORDER BY created_at DESC LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`;
  params.push(limit, offset);

  const result = await query(listQuery, params);

  return { workspaces: result.rows.map(serializeRow), total };
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

  const updated = serializeRow(result.rows[0]);

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

  await logAuditAction(
    id,
    null,  // thread_id
    updated_by || null,  // user_id
    'UPDATE_WORKSPACE',  // action_type
    old,  // input_data
    updated  // output_data
  );

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

  await logAuditAction(
    id,
    null,  // thread_id
    deleted_by || null,  // user_id
    'DELETE_WORKSPACE',  // action_type
    workspace,  // input_data
    null  // output_data
  );
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
    `INSERT INTO zalo_groups (workspace_id, thread_id, name, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     RETURNING id, workspace_id, thread_id, name, created_at, updated_at`,
    [workspace_id, thread_id, name || null]
  );

  if (result.rows.length === 0) {
    throw new Error('Failed to add zalo group');
  }

  const group = serializeRow(result.rows[0]);

  // Create in Neo4j
  try {
    await executeQuery(
      `MATCH (w:Workspace {id: $workspace_id})
       MERGE (g:ZaloGroup {id: $id, thread_id: $thread_id})
       SET g.name = $name
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

  await logAuditAction(
    workspace_id,
    null,  // thread_id
    created_by || null,  // user_id
    'ADD_ZALO_GROUP',  // action_type
    null,  // input_data
    group  // output_data
  );

  return group;
}

/**
 * Get Zalo Groups in Workspace
 */
export async function getWorkspaceZaloGroups(
  workspace_id: string,
  limit: number = 100,
  offset: number = 0,
  filterByUserId?: string
): Promise<{ groups: ZaloGroup[]; total: number }> {
  let groupIds: string[] | null = null;

  // If filtering by user, get group IDs from Neo4j (where user is MEMBER_OF)
  if (filterByUserId) {
    const neo4jResult = await executeQuery(
      `MATCH (u:ZaloUser {id: $user_id})-[:MEMBER_OF]->(g:ZaloGroup)-[:BELONGS_TO]->(w:Workspace {id: $workspace_id})
       RETURN g.id AS id`,
      { user_id: filterByUserId, workspace_id }
    );
    groupIds = neo4jResult.records.map(r => r.get('id'));

    if (groupIds.length === 0) {
      return { groups: [], total: 0 };
    }
  }

  let countQuery = `SELECT COUNT(*) as count FROM zalo_groups WHERE workspace_id = $1`;
  let listQuery = `SELECT id, workspace_id, thread_id, name, created_at, updated_at FROM zalo_groups WHERE workspace_id = $1`;
  const params: any[] = [workspace_id];

  if (groupIds) {
    countQuery += ' AND id = ANY($2)';
    listQuery += ' AND id = ANY($2)';
    params.push(groupIds);
  }

  const countResult = await query(countQuery, params);
  const total = parseInt(countResult.rows[0].count, 10);

  const limitParamIndex = params.length + 1;
  const offsetParamIndex = params.length + 2;
  listQuery += ` ORDER BY created_at DESC LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`;
  params.push(limit, offset);

  const result = await query(listQuery, params);

  return { groups: result.rows.map(serializeRow), total };
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

  await logAuditAction(
    workspace_id,
    null,  // thread_id
    removed_by || null,  // user_id
    'REMOVE_ZALO_GROUP',  // action_type
    group,  // input_data
    null  // output_data
  );
}

/**
 * Get Zalo Group by thread_id
 */
export async function getZaloGroupByThreadId(thread_id: string): Promise<ZaloGroup | null> {
  const result = await query(
    `SELECT id, workspace_id, thread_id, name, created_at, updated_at
     FROM zalo_groups
     WHERE thread_id = $1`,
    [thread_id]
  );

  return result.rows.length > 0 ? serializeRow(result.rows[0]) : null;
}

/**
 * Assign user role in workspace — Neo4j only
 * Tạo/cập nhật relationship PART_OF giữa ZaloUser và Workspace trong Neo4j.
 * Không dùng bảng workspace_user_roles.
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

  // Lấy thông tin user từ PostgreSQL để xác nhận tồn tại
  const userResult = await query(
    `SELECT id, zalo_id, full_name FROM user_profile WHERE id = $1`,
    [user_id]
  );
  if (userResult.rows.length === 0) {
    throw new Error(`User not found: ${user_id}`);
  }

  // Lấy thông tin workspace để xác nhận tồn tại
  const wsResult = await query(
    `SELECT id FROM workspaces WHERE id = $1`,
    [workspace_id]
  );
  if (wsResult.rows.length === 0) {
    throw new Error(`Workspace not found: ${workspace_id}`);
  }

  // MERGE relationship trong Neo4j — tạo mới hoặc cập nhật role
  await executeQuery(
    `MATCH (u:ZaloUser {id: $user_id})
     MATCH (w:Workspace {id: $workspace_id})
     MERGE (u)-[r:PART_OF]->(w)
     SET r.role = $role, r.assigned_at = datetime()
     RETURN r`,
    { user_id, workspace_id, role }
  );

  await logAuditAction(
    workspace_id,
    null,
    assigned_by || null,
    'ASSIGN_USER_ROLE',
    null,
    { user_id, workspace_id, role }
  );

  return { user_id, workspace_id, role };
}

/**
 * Remove user from workspace — Neo4j only
 * Xóa relationship PART_OF giữa ZaloUser và Workspace trong Neo4j.
 */
export async function removeUserFromWorkspace(
  workspace_id: string,
  user_id: string,
  removed_by?: string
): Promise<void> {
  // Xóa relationship PART_OF với Workspace và MEMBER_OF với các ZaloGroup thuộc Workspace đó trong Neo4j
  await executeQuery(
    `MATCH (u:ZaloUser {id: $user_id})
     OPTIONAL MATCH (u)-[r1:PART_OF]->(w:Workspace {id: $workspace_id})
     OPTIONAL MATCH (u)-[r2:MEMBER_OF]->(g:ZaloGroup)-[:BELONGS_TO]->(w)
     DELETE r1, r2`,
    { user_id, workspace_id }
  );

  await logAuditAction(
    workspace_id,
    null,
    removed_by || null,
    'REMOVE_USER_FROM_WORKSPACE',
    null,
    null
  );
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
      workspaces: result.rows.map(serializeRow),
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
    workspaces: result.rows.map(serializeRow),
    total: parseInt(countResult.rows[0].count)
  };
}

/**
 * Get Users in Workspace — từ Neo4j relationships
 * Query các ZaloUser có relationship PART_OF tới Workspace,
 * sau đó join với user_profile trong PostgreSQL để lấy thông tin chi tiết.
 */
export async function getWorkspaceUsers(
  workspace_id: string,
  limit: number = 100,
  offset: number = 0
): Promise<{ users: any[]; total: number }> {
  // 1. Đếm tổng số user trước (disableLosslessIntegers: true → count() là JS number thuần)
  const countResult = await executeQuery(
    `MATCH (u:ZaloUser)-[:PART_OF]->(w:Workspace {id: $workspace_id})
     RETURN count(u) AS total`,
    { workspace_id }
  );
  const total: number = countResult.records.length > 0
    ? (countResult.records[0].get('total') as number)
    : 0;

  if (total === 0) {
    return { users: [], total: 0 };
  }

  // 2. Lấy danh sách user_id và role từ Neo4j (với phân trang)
  const neo4jResult = await executeQuery(
    `MATCH (u:ZaloUser)-[r:PART_OF]->(w:Workspace {id: $workspace_id})
     RETURN u.id AS user_id, r.role AS role, r.assigned_at AS assigned_at
     ORDER BY r.assigned_at DESC
     SKIP $offset LIMIT $limit`,
    { workspace_id, offset: neo4j.int(offset), limit: neo4j.int(limit) }
  );

  const records = neo4jResult.records;

  if (records.length === 0) {
    return { users: [], total };
  }

  const userIds = records.map((r: any) => r.get('user_id'));
  const roleMap = new Map<string, { role: string; assigned_at: string | null }>(
    records.map((r: any) => {
      const assignedAt = r.get('assigned_at');
      return [
        r.get('user_id'),
        {
          role: r.get('role') || 'MEMBER',
          // Convert Neo4j temporal object (datetime()) to ISO string if needed
          assigned_at: assignedAt
            ? (typeof assignedAt === 'string' ? assignedAt : assignedAt.toString())
            : null,
        },
      ];
    })
  );

  // 3. Lấy thông tin chi tiết từ PostgreSQL
  const placeholders = userIds.map((_: any, i: number) => `$${i + 1}`).join(', ');
  const pgResult = await query(
    `SELECT id, zalo_id, full_name, email, phone
     FROM user_profile
     WHERE id = ANY(ARRAY[${placeholders}]::uuid[])`,
    userIds
  );

  const users = pgResult.rows.map((u: any) => {
    const meta = roleMap.get(u.id) || { role: 'MEMBER', assigned_at: null };
    return serializeRow({
      ...u,
      role: meta.role,
      joined_at: meta.assigned_at,
    });
  });

  return { users, total };
}

/**
 * Get Tools in Workspace
 */
export async function getWorkspaceTools(
  workspace_id: string
): Promise<any[]> {
  const result = await executeQuery(
    `MATCH (w:Workspace {id: $workspace_id})-[:CAN_USE]->(t:Tool)
     RETURN t { .id, .key, .name, .description, .status } as tool`,
    { workspace_id }
  );

  return result.records.map(record => record.get('tool'));
}

/**
 * Add Tool to Workspace
 */
export async function addToolToWorkspace(
  workspace_id: string,
  tool_id: string, // receiving tool_id (uuid) but Neo4j might use key or id. Tool node should have id.
  added_by?: string
): Promise<void> {
  // Check if tool exists in PG to get the key or ensure it exists
  const toolCheck = await query('SELECT key, name FROM tools WHERE id = $1', [tool_id]);
  if (toolCheck.rows.length === 0) {
    throw new Error('Tool not found');
  }
  const tool = toolCheck.rows[0];

  await executeQuery(
    `MATCH (w:Workspace {id: $workspace_id})
     MATCH (t:Tool {key: $key})
     MERGE (w)-[:CAN_USE]->(t)
     RETURN w`,
    { workspace_id, key: tool.key }
  );

  await logAuditAction(workspace_id, null, added_by || null, 'ADD_TOOL_TO_WORKSPACE', { tool_key: tool.key }, null);
}

/**
 * Remove Tool from Workspace
 * Also cascade-deletes all Data nodes linked to this tool in this workspace
 */
export async function removeToolFromWorkspace(
  workspace_id: string,
  tool_id: string,
  removed_by?: string
): Promise<void> {
  const toolCheck = await query('SELECT key FROM tools WHERE id = $1', [tool_id]);
  if (toolCheck.rows.length === 0) {
    throw new Error('Tool not found');
  }
  const tool_key = toolCheck.rows[0].key;

  // Remove the CAN_USE relationship between Workspace and Tool
  await executeQuery(
    `MATCH (w:Workspace {id: $workspace_id})-[r:CAN_USE]->(t:Tool {key: $key})
     DELETE r`,
    { workspace_id, key: tool_key }
  );

  await logAuditAction(workspace_id, null, removed_by || null, 'REMOVE_TOOL_FROM_WORKSPACE', { tool_key }, null);
}

/**
 * Get Skills in Workspace
 */
export async function getWorkspaceSkills(
  workspace_id: string,
  limit: number = 100,
  offset: number = 0
): Promise<{ skills: any[]; total: number }> {
  // Get skill IDs from Neo4j
  const neo4jRes = await executeQuery(
    `MATCH (s:Skill)-[:SHARED_TO]->(w:Workspace {id: $workspace_id})
     RETURN s.id AS id`,
    { workspace_id }
  );
  const skillIds = neo4jRes.records.map(r => r.get('id'));

  if (skillIds.length === 0) {
    return { skills: [], total: 0 };
  }

  const result = await query(
    `SELECT id, name, description, is_shared, created_at
       FROM skills
       WHERE id = ANY($1)
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
    [skillIds, limit, offset]
  );

  return { skills: result.rows.map(serializeRow), total: skillIds.length };
}

/**
 * Remove Skill (Full delete)
 */
export async function deleteSkill(
  skill_id: string,
  deleted_by?: string
): Promise<void> {
  const skillResult = await query('SELECT name FROM skills WHERE id = $1', [skill_id]);
  if (skillResult.rows.length === 0) throw new Error('Skill not found');
  const skill = skillResult.rows[0];

  // Delete from Neo4j
  await executeQuery(
    `MATCH (s:Skill {id: $id}) DETACH DELETE s`,
    { id: skill_id }
  );

  // Delete from PG
  await query('DELETE FROM skills WHERE id = $1', [skill_id]);

  await logAuditAction(skill.workspace_id, null, deleted_by || null, 'DELETE_SKILL', { skill_name: skill.name }, null);
}
