
import { query, executeQuery } from '@/lib/db';
import { logAuditAction } from './audit.service';
import { hashPassword } from '@/lib/auth';

/**
 * User Profile Type
 */
export interface UserProfile {
  id: string;
  zalo_id: string | null;
  username: string | null;
  password_hash: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  note: string | null;
  role: string | null;
  status: 'active' | 'inactive';
  api_token: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserRequest {
  zalo_id?: string;
  username?: string;
  password?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  gender?: string;
  note?: string;
  role?: string;
  api_token?: string;
}

export interface UpdateUserRequest {
  zalo_id?: string | null;
  username?: string | null;
  password?: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  note?: string | null;
  role?: string | null;
  status?: 'active' | 'inactive';
}

/**
 * User Service
 */
export class UserService {
  /**
   * Create new user
   */
  static async createUser(req: CreateUserRequest, created_by?: string): Promise<UserProfile> {
    const { zalo_id, username, password, full_name, email, phone, gender, note, role } = req;

    // Check if user exists
    if (zalo_id) {
      const check = await query('SELECT id FROM user_profile WHERE zalo_id = $1', [zalo_id]);
      if (check.rows.length > 0) {
        throw new Error(`User with Zalo ID ${zalo_id} already exists`);
      }
    }

    if (username) {
      const checkUsername = await query('SELECT id FROM user_profile WHERE username = $1', [username]);
      if (checkUsername.rows.length > 0) {
        throw new Error(`Username ${username} already exists`);
      }
    }

    const passwordHash = password ? await hashPassword(password) : null;

    // 1. Create in PostgreSQL
    const apiToken = req.api_token || `zp_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    const result = await query(
      `INSERT INTO user_profile (zalo_id, username, password_hash, full_name, email, phone, gender, note, role, status, api_token, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10, NOW(), NOW())
       RETURNING *`,
      [zalo_id || null, username || null, passwordHash, full_name || null, email || null, phone || null, gender || null, note || null, role || 'user', apiToken]
    );

    const user = result.rows[0];

    // 2. Sync to Neo4j (minimal data: id, zalo_id, name)
    try {
      await executeQuery(
        `CREATE (u:ZaloUser {id: $id, zalo_id: $zalo_id, name: $name})
         RETURN u`,
        { id: user.id, zalo_id: user.zalo_id, name: user.full_name || null }
      );
    } catch (error) {
      console.error('Failed to sync user to Neo4j:', error);
    }

    try {
      await logAuditAction(null, null, created_by || null, 'CREATE_USER', { user_id: user.id }, user);
    } catch (auditErr) {
      console.warn('Failed to log audit action (non-critical):', auditErr);
    }

    return user;
  }

  /**
   * Get all users
   */
  static async getUsers(limit: number = 100, offset: number = 0, search?: string): Promise<{ users: UserProfile[], total: number }> {
    let queryText = 'SELECT * FROM user_profile';
    let countQuery = 'SELECT COUNT(*) as total FROM user_profile';
    const params: any[] = [];

    if (search) {
      queryText += ` WHERE full_name ILIKE $1 OR zalo_id ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1 OR username ILIKE $1`;
      countQuery += ` WHERE full_name ILIKE $1 OR zalo_id ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1 OR username ILIKE $1`;
      params.push(`%${search}%`);
    }

    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);

    queryText += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    return { users: result.rows, total };
  }

  /**
   * Get user by ID
   */
  static async getUserById(id: string): Promise<UserProfile | null> {
    const result = await query('SELECT * FROM user_profile WHERE id = $1', [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Update user
   */
  static async updateUser(id: string, updates: UpdateUserRequest, updated_by?: string): Promise<UserProfile> {
    const oldUser = await this.getUserById(id);
    if (!oldUser) {
      throw new Error('User not found');
    }

    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        if (key === 'username' && value) {
          const check = await query('SELECT id FROM user_profile WHERE username = $1 AND id != $2', [value, id]);
          if (check.rows.length > 0) {
            throw new Error(`Username ${value} already exists`);
          }
        }

        if (key === 'zalo_id' && value) {
          const check = await query('SELECT id FROM user_profile WHERE zalo_id = $1 AND id != $2', [value, id]);
          if (check.rows.length > 0) {
            throw new Error(`Zalo ID ${value} already exists`);
          }
        }

        if (key === 'password') {
          fields.push(`password_hash = $${paramIndex++}`);
          values.push(await hashPassword(value as string));
        } else {
          fields.push(`${key} = $${paramIndex++}`);
          values.push(value);
        }
      }
    }

    if (fields.length === 0) return oldUser;

    fields.push(`updated_at = NOW()`);
    values.push(id);

    // 1. Update PostgreSQL
    const result = await query(
      `UPDATE user_profile
       SET ${fields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    const updatedUser = result.rows[0];

    // 2. Update Neo4j (if relevant fields changed, e.g. zalo_id, though typically immutable)
    if (updates.zalo_id || updates.full_name) {
      try {
        await executeQuery(
          `MATCH (u:ZaloUser {id: $id})
           SET u.zalo_id = $zalo_id, u.name = $name
           RETURN u`,
          { 
            id, 
            zalo_id: updatedUser.zalo_id, 
            name: updatedUser.full_name 
          }
        );
      } catch (error) {
        console.error('Failed to update user in Neo4j:', error);
      }
    }

    try {
      await logAuditAction(null, null, updated_by || null, 'UPDATE_USER', { user_id: id, changes: updates }, updatedUser);
    } catch (auditErr) {
      console.warn('Failed to log audit action (non-critical):', auditErr);
    }

    return updatedUser;
  }

  /**
   * Delete user (Deep delete)
   */
  static async deleteUser(id: string, deleted_by?: string): Promise<void> {
    const user = await this.getUserById(id);
    if (!user) {
      throw new Error('User not found');
    }

    // 1. Delete from Neo4j (and all relationships)
    await executeQuery(
      `MATCH (u:ZaloUser {id: $id})
       DETACH DELETE u`,
      { id }
    );

    // 2. Delete from PostgreSQL
    await query('DELETE FROM user_profile WHERE id = $1', [id]);

    try {
      await logAuditAction(null, null, deleted_by || null, 'DELETE_USER', { user_id: id }, null);
    } catch (auditErr) {
      console.warn('Failed to log audit action (non-critical):', auditErr);
    }
  }

  /**
   * Merge User Source into User Target
   */
  static async mergeUsers(targetId: string, sourceId: string, mergedBy?: string): Promise<UserProfile> {
    if (targetId === sourceId) throw new Error('Cannot merge user into itself');

    const target = await this.getUserById(targetId);
    const source = await this.getUserById(sourceId);

    if (!target || !source) throw new Error('One or both users not found');

    let realTargetId = targetId;
    let realSourceId = sourceId;

    // Logic: Account with Zalo ID is prioritized
    if (source.zalo_id && !target.zalo_id) {
      realTargetId = sourceId;
      realSourceId = targetId;
    }

    const finalTarget = await this.getUserById(realTargetId);
    const finalSource = await this.getUserById(realSourceId);
    if (!finalTarget || !finalSource) throw new Error('Terminal error: users not found after identification');

    // 1. Move relationships in PostgreSQL
    // Update workspace roles
    // First, delete any s.user_id = sourceId that already exist as t.user_id = targetId in the same workspace
    await query(
      `DELETE FROM workspace_user_roles s
       WHERE s.user_id = $2 
       AND EXISTS (
         SELECT 1 FROM workspace_user_roles t 
         WHERE t.user_id = $1 
         AND t.workspace_id = s.workspace_id
       )`,
      [realTargetId, realSourceId]
    );
    // Then update the remaining ones
    await query(
      `UPDATE workspace_user_roles SET user_id = $1 WHERE user_id = $2`,
      [realTargetId, realSourceId]
    );

    // Update audit logs
    await query(`UPDATE audit_logs SET user_id = $1 WHERE user_id = $2`, [realTargetId, realSourceId]);

    // Update zalo group members
    // First, delete any s.user_id = sourceId that already exist as t.user_id = targetId in the same zalo_group
    await query(
      `DELETE FROM zalo_group_members s
       WHERE s.user_id = $2 
       AND EXISTS (
         SELECT 1 FROM zalo_group_members t 
         WHERE t.user_id = $1 
         AND t.zalo_group_id = s.zalo_group_id
       )`,
      [realTargetId, realSourceId]
    );
    // Then update the remaining ones
    await query(
      `UPDATE zalo_group_members SET user_id = $1 WHERE user_id = $2`,
      [realTargetId, realSourceId]
    );

    // 2. Move relationships in Neo4j
    try {
      await executeQuery(
        `MATCH (s:ZaloUser {id: $sourceId})
         MATCH (t:ZaloUser {id: $targetId})
         MATCH (s)-[r]->(x)
         WHERE NOT (t)-[:PART_OF]->(x) 
         CREATE (t)-[r2:TYPE(r)]->(x)
         SET r2 = r
         WITH r
         DELETE r`,
        { sourceId: realSourceId, targetId: realTargetId }
      );
      await executeQuery(
        `MATCH (s:ZaloUser {id: $sourceId})
         DETACH DELETE s`,
         { sourceId: realSourceId }
      );
    } catch (error) {
      console.error('Failed to migrate Neo4j relationships during merge:', error);
    }

    // 3. Delete Source User from Postgres
    await query(`DELETE FROM user_profile WHERE id = $1`, [realSourceId]);

    // 4. Final data merge
    const updates: Partial<UserProfile> = {};
    if (!finalTarget.full_name && finalSource.full_name) updates.full_name = finalSource.full_name;
    if (!finalTarget.email && finalSource.email) updates.email = finalSource.email;
    if (!finalTarget.phone && finalSource.phone) updates.phone = finalSource.phone;
    if (!finalTarget.username && finalSource.username) updates.username = finalSource.username;
    
    // Fix: If the person performing the merge is the one being deleted, 
    // update their ID to the target ID for subsequent audit logs.
    const logBy = mergedBy === realSourceId ? realTargetId : mergedBy;

    if (Object.keys(updates).length > 0) {
      await this.updateUser(realTargetId, updates, logBy);
    }

    await logAuditAction(null, null, logBy || null, 'MERGE_USERS', 
      { target_id: realTargetId, source_id: realSourceId }, finalTarget);

    return (await this.getUserById(realTargetId))!;
  }

  /**
   * Get user by Zalo ID
   */
  static async getUserByZaloId(zalo_id: string): Promise<UserProfile | null> {
    const result = await query('SELECT * FROM user_profile WHERE zalo_id = $1', [zalo_id]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Get user by username, email, or Zalo ID (for login)
   */
  static async getUserByUsername(identifier: string): Promise<UserProfile | null> {
    const result = await query(
      `SELECT * FROM user_profile 
       WHERE username = $1 OR email = $1 OR zalo_id = $1`, 
      [identifier]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Get user role in workspace
   */
  static async getUserRoleInWorkspace(workspace_id: string, user_id: string): Promise<string | null> {
    const result = await executeQuery(
      `MATCH (u:ZaloUser {id: $user_id})-[r:PART_OF]->(w:Workspace {id: $workspace_id})
       RETURN r.role AS role`,
      { user_id, workspace_id }
    );
    if (result.records.length === 0) return null;
    return result.records[0].get('role');
  }

  /**
   * Get user by API Token
   */
  static async getUserByApiToken(token: string): Promise<UserProfile | null> {
    const result = await query('SELECT * FROM user_profile WHERE api_token = $1', [token]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Reroll API Token
   */
  static async rerollApiToken(userId: string): Promise<string> {
    const newToken = `zp_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    await query('UPDATE user_profile SET api_token = $1, updated_at = NOW() WHERE id = $2', [newToken, userId]);
    
    try {
      await logAuditAction(null, null, userId, 'REROLL_API_TOKEN', { user_id: userId }, { new_token_generated: true });
    } catch (auditErr) {
      console.warn('Failed to log audit action for token reroll:', auditErr);
    }
    
    return newToken;
  }
}
