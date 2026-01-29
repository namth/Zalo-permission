import { executeQuery } from '@/lib/db';
import { query } from '@/lib/db';
import { ZaloUserNode, UserProfile } from '@/types';

/**
 * Create a new ZaloUser in Neo4j
 */
export async function createZaloUser(
  zalo_user_id: string,
  name?: string
): Promise<ZaloUserNode> {
  const result = await executeQuery(
    `CREATE (u:ZaloUser {
      zalo_user_id: $zalo_user_id,
      name: $name,
      created_at: datetime()
    })
    RETURN u { .zalo_user_id, .name, .created_at } as user`,
    { zalo_user_id, name: name || null }
  );

  if (result.records.length === 0) {
    throw new Error(`Failed to create ZaloUser: ${zalo_user_id}`);
  }

  return result.records[0].get('user');
}

/**
 * Get or create a ZaloUser
 */
export async function getOrCreateZaloUser(
  zalo_user_id: string,
  name?: string
): Promise<ZaloUserNode> {
  // Check if user exists
  const existingResult = await executeQuery(
    'MATCH (u:ZaloUser {zalo_user_id: $zalo_user_id}) RETURN u { .zalo_user_id, .name, .created_at } as user',
    { zalo_user_id }
  );

  if (existingResult.records.length > 0) {
    return existingResult.records[0].get('user');
  }

  // Create new user if doesn't exist
  return createZaloUser(zalo_user_id, name);
}

/**
 * Get ZaloUser profile from SQL (LEGACY - use new users table instead)
 * Kept for backward compatibility
 */
export async function getUserProfile(zalo_user_id: string): Promise<UserProfile | null> {
  const result = await query(
    'SELECT id, zalo_user_id, phone, note, created_at, updated_at FROM user_profile WHERE zalo_user_id = $1',
    [zalo_user_id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * Update user profile in SQL (LEGACY - use new users table instead)
 * Kept for backward compatibility
 */
export async function updateUserProfile(
  zalo_user_id: string,
  phone?: string,
  note?: string
): Promise<UserProfile> {
  const result = await query(
    `INSERT INTO user_profile (zalo_user_id, phone, note, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (zalo_user_id) 
     DO UPDATE SET phone = $2, note = $3, updated_at = NOW()
     RETURNING id, zalo_user_id, phone, note, created_at, updated_at`,
    [zalo_user_id, phone || null, note || null]
  );

  if (result.rows.length === 0) {
    throw new Error(`Failed to update user profile: ${zalo_user_id}`);
  }

  return result.rows[0];
}

/**
 * IMPORTANT: New code should use user.service.ts instead!
 * That service uses the new 'users' table which has more fields:
 * - email
 * - address
 * - gender
 * Plus automatic Neo4j relationship setup
 */

/**
 * Get ZaloUser by ID
 */
export async function getZaloUser(zalo_user_id: string): Promise<ZaloUserNode | null> {
  const result = await executeQuery(
    'MATCH (u:ZaloUser {zalo_user_id: $zalo_user_id}) RETURN u { .zalo_user_id, .name, .created_at } as user',
    { zalo_user_id }
  );

  if (result.records.length === 0) {
    return null;
  }

  return result.records[0].get('user');
}
