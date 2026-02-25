
import { query, executeQuery } from '@/lib/db';
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
  status: 'active' | 'inactive';
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserRequest {
  zalo_id: string;
  full_name?: string;
  email?: string;
  phone?: string;
  gender?: string;
  note?: string;
}

export interface UpdateUserRequest {
  full_name?: string;
  email?: string;
  phone?: string;
  gender?: string;
  note?: string;
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
    const { zalo_id, full_name, email, phone, gender, note } = req;

    // Check if user exists
    const check = await query('SELECT id FROM user_profile WHERE zalo_id = $1', [zalo_id]);
    if (check.rows.length > 0) {
      throw new Error(`User with Zalo ID ${zalo_id} already exists`);
    }

    // 1. Create in PostgreSQL
    const result = await query(
      `INSERT INTO user_profile (zalo_id, full_name, email, phone, gender, note, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW(), NOW())
       RETURNING *`,
      [zalo_id, full_name || null, email || null, phone || null, gender || null, note || null]
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
      // Rollback PG? Or just log? For now, we log. Ideally, use transaction.
    }

    await logAuditAction(null, null, created_by || null, 'CREATE_USER', { user_id: user.id }, user);

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
      queryText += ` WHERE full_name ILIKE $1 OR zalo_id ILIKE $1 OR email ILIKE $1`;
      countQuery += ` WHERE full_name ILIKE $1 OR zalo_id ILIKE $1 OR email ILIKE $1`;
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

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    });

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
    // Here we only synced id and zalo_id. zalo_id is unique/immutable usually.

    await logAuditAction(null, null, updated_by || null, 'UPDATE_USER', { user_id: id, changes: updates }, updatedUser);

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

    await logAuditAction(null, null, deleted_by || null, 'DELETE_USER', { user_id: id }, null);
  }

  /**
   * Get user by Zalo ID
   */
  static async getUserByZaloId(zalo_id: string): Promise<UserProfile | null> {
    const result = await query('SELECT * FROM user_profile WHERE zalo_id = $1', [zalo_id]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Get user role in workspace
   */
  static async getUserRoleInWorkspace(workspace_id: string, user_id: string): Promise<string | null> {
    const result = await query(
      'SELECT role FROM workspace_user_roles WHERE workspace_id = $1 AND user_id = $2',
      [workspace_id, user_id]
    );
    return result.rows.length > 0 ? result.rows[0].role : null;
  }
}
