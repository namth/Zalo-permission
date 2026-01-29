import { query } from '@/lib/db';
import { executeQuery } from '@/lib/neo4j';
import { logAuditAction } from './audit.service';

/**
 * User Profile Type
 */
export interface UserProfile {
  id: string;
  zalo_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  note: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Create User Request
 */
export interface CreateUserRequest {
  zalo_id: string;
  full_name: string;
  email?: string;
  phone?: string;
  gender?: string;
  note?: string;
}

/**
 * Create or get user by zalo_id
 * Syncs with Neo4j
 */
export async function createOrGetUser(
  data: CreateUserRequest,
  workspace_id?: string
): Promise<UserProfile> {
  // Check if user already exists
  const existing = await getUserByZaloId(data.zalo_id);
  if (existing) {
    return existing;
  }

  // Create in PostgreSQL
  const result = await query(
    `INSERT INTO user_profile (zalo_id, full_name, email, phone, gender, note, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW(), NOW())
     RETURNING id, zalo_id, full_name, email, phone, gender, note, status, created_at, updated_at`,
    [
      data.zalo_id,
      data.full_name || data.zalo_id,
      data.email || null,
      data.phone || null,
      data.gender || null,
      data.note || null
    ]
  );

  if (result.rows.length === 0) {
    throw new Error('Failed to create user');
  }

  const user = result.rows[0];

  // Sync with Neo4j
  try {
    await executeQuery(
      `MERGE (u:User {id: $id, zalo_id: $zalo_id})
       SET u.full_name = $full_name, u.created_at = datetime()
       RETURN u`,
      {
        id: user.id,
        zalo_id: user.zalo_id,
        full_name: user.full_name
      }
    );
  } catch (error) {
    console.error('Failed to sync user to Neo4j:', error);
    // Continue - PostgreSQL is source of truth
  }

  // Log audit
  await logAuditAction(
    workspace_id || null,
    user.id,
    'CREATE_USER',
    'User',
    user.id,
    null,
    user
  );

  return user;
}

/**
 * Get user by zalo_id
 */
export async function getUserByZaloId(zalo_id: string): Promise<UserProfile | null> {
  const result = await query(
    `SELECT id, zalo_id, full_name, email, phone, gender, note, status, created_at, updated_at
     FROM user_profile
     WHERE zalo_id = $1`,
    [zalo_id]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<UserProfile | null> {
  const result = await query(
    `SELECT id, zalo_id, full_name, email, phone, gender, note, status, created_at, updated_at
     FROM user_profile
     WHERE id = $1`,
    [id]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Get all users with pagination
 */
export async function listUsers(
  limit: number = 20,
  offset: number = 0
): Promise<{ users: UserProfile[]; total: number }> {
  const countResult = await query('SELECT COUNT(*) as count FROM user_profile');
  const total = countResult.rows[0].count;

  const result = await query(
    `SELECT id, zalo_id, full_name, email, phone, gender, note, status, created_at, updated_at
     FROM user_profile
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return { users: result.rows, total };
}

/**
 * Update user profile
 */
export async function updateUser(
  id: string,
  updates: Partial<Omit<UserProfile, 'id' | 'zalo_id' | 'created_at' | 'updated_at'>>,
  workspace_id?: string
): Promise<UserProfile> {
  // Get old value for audit
  const oldUser = await getUserById(id);
  if (!oldUser) {
    throw new Error(`User not found: ${id}`);
  }

  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.full_name !== undefined) {
    fields.push(`full_name = $${paramIndex++}`);
    values.push(updates.full_name);
  }
  if (updates.email !== undefined) {
    fields.push(`email = $${paramIndex++}`);
    values.push(updates.email);
  }
  if (updates.phone !== undefined) {
    fields.push(`phone = $${paramIndex++}`);
    values.push(updates.phone);
  }
  if (updates.gender !== undefined) {
    fields.push(`gender = $${paramIndex++}`);
    values.push(updates.gender);
  }
  if (updates.note !== undefined) {
    fields.push(`note = $${paramIndex++}`);
    values.push(updates.note);
  }
  if (updates.status !== undefined) {
    fields.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }

  if (fields.length === 0) {
    return oldUser;
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE user_profile
     SET ${fields.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING id, zalo_id, full_name, email, phone, gender, note, status, created_at, updated_at`,
    values
  );

  if (result.rows.length === 0) {
    throw new Error(`User not found: ${id}`);
  }

  const updatedUser = result.rows[0];

  // Sync with Neo4j
  try {
    await executeQuery(
      `MATCH (u:User {id: $id})
       SET u.full_name = $full_name
       RETURN u`,
      {
        id: id,
        full_name: updatedUser.full_name
      }
    );
  } catch (error) {
    console.error('Failed to sync user update to Neo4j:', error);
  }

  // Log audit
  await logAuditAction(
    workspace_id || null,
    id,
    'UPDATE_USER',
    'User',
    id,
    oldUser,
    updatedUser
  );

  return updatedUser;
}

/**
 * Delete user from system
 */
export async function deleteUser(id: string, workspace_id?: string): Promise<void> {
  const user = await getUserById(id);
  if (!user) {
    throw new Error(`User not found: ${id}`);
  }

  // Delete from PostgreSQL
  await query('DELETE FROM user_profile WHERE id = $1', [id]);

  // Delete from Neo4j
  try {
    await executeQuery(
      `MATCH (u:User {id: $id})
       DETACH DELETE u`,
      { id }
    );
  } catch (error) {
    console.error('Failed to delete user from Neo4j:', error);
  }

  // Log audit
  await logAuditAction(
    workspace_id || null,
    id,
    'DELETE_USER',
    'User',
    id,
    user,
    null
  );
}

/**
 * Get users in a workspace with their roles
 */
export async function getWorkspaceUsers(
  workspace_id: string,
  limit: number = 100,
  offset: number = 0
): Promise<{ users: any[]; total: number }> {
  const countResult = await query(
    `SELECT COUNT(*) as count
     FROM workspace_user_roles wr
     JOIN user_profile u ON wr.user_id = u.id
     WHERE wr.workspace_id = $1`,
    [workspace_id]
  );

  const total = countResult.rows[0].count;

  const result = await query(
    `SELECT 
       u.id, u.zalo_id, u.full_name, u.email, u.phone, u.gender, u.status,
       wr.role, wr.assigned_by, wr.created_at as role_created_at
     FROM workspace_user_roles wr
     JOIN user_profile u ON wr.user_id = u.id
     WHERE wr.workspace_id = $1
     ORDER BY u.created_at DESC
     LIMIT $2 OFFSET $3`,
    [workspace_id, limit, offset]
  );

  return { users: result.rows, total };
}

/**
 * Get user role in workspace
 */
export async function getUserRoleInWorkspace(
  workspace_id: string,
  user_id: string
): Promise<string | null> {
  const result = await query(
    `SELECT role
     FROM workspace_user_roles
     WHERE workspace_id = $1 AND user_id = $2`,
    [workspace_id, user_id]
  );

  return result.rows.length > 0 ? result.rows[0].role : null;
}
