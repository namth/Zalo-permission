import { query } from '@/lib/db';
import { logAuditAction } from './audit.service';

/**
 * Account Type
 */
export interface Account {
  id: string;
  workspace_id: string;
  type: string;
  reference_id?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

/**
 * Create account
 */
export async function createAccount(
  workspace_id: string,
  type: string,
  reference_id?: string,
  metadata?: Record<string, any>,
  created_by?: string
): Promise<Account> {
  const result = await query(
    `INSERT INTO accounts (workspace_id, type, reference_id, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     RETURNING id, workspace_id, type, reference_id, metadata, created_at, updated_at`,
    [workspace_id, type, reference_id || null, metadata ? JSON.stringify(metadata) : JSON.stringify({})]
  );

  if (result.rows.length === 0) {
    throw new Error('Failed to create account');
  }

  const account = result.rows[0];

  // Log audit
  await logAuditAction(workspace_id, created_by || null, 'CREATE_ACCOUNT', 'Account', account.id, null, account);

  return account;
}

/**
 * Get account by ID
 */
export async function getAccount(id: string): Promise<Account | null> {
  const result = await query(
    `SELECT id, workspace_id, type, reference_id, metadata, created_at, updated_at
     FROM accounts
     WHERE id = $1`,
    [id]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * List accounts by workspace
 */
export async function listWorkspaceAccounts(
  workspace_id: string,
  limit: number = 100,
  offset: number = 0
): Promise<{ accounts: Account[]; total: number }> {
  const countResult = await query(
    'SELECT COUNT(*) as count FROM accounts WHERE workspace_id = $1',
    [workspace_id]
  );
  const total = countResult.rows[0].count;

  const result = await query(
    `SELECT id, workspace_id, type, reference_id, metadata, created_at, updated_at
     FROM accounts
     WHERE workspace_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [workspace_id, limit, offset]
  );

  return { accounts: result.rows, total };
}

/**
 * Update account
 */
export async function updateAccount(
  id: string,
  updates: {
    type?: string;
    reference_id?: string;
    metadata?: Record<string, any>;
  },
  updated_by?: string
): Promise<Account> {
  // Get current account for audit
  const current = await getAccount(id);
  if (!current) {
    throw new Error('Account not found');
  }

  const { type, reference_id, metadata } = updates;

  const result = await query(
    `UPDATE accounts
     SET type = COALESCE($1, type),
         reference_id = COALESCE($2, reference_id),
         metadata = CASE WHEN $3::jsonb IS NOT NULL THEN $3 ELSE metadata END,
         updated_at = NOW()
     WHERE id = $4
     RETURNING id, workspace_id, type, reference_id, metadata, created_at, updated_at`,
    [
      type || null,
      reference_id || null,
      metadata ? JSON.stringify(metadata) : null,
      id
    ]
  );

  if (result.rows.length === 0) {
    throw new Error('Failed to update account');
  }

  const updated = result.rows[0];

  // Log audit
  await logAuditAction(
    current.workspace_id,
    updated_by || null,
    'UPDATE_ACCOUNT',
    'Account',
    id,
    current,
    updated
  );

  return updated;
}

/**
 * Delete account
 */
export async function deleteAccount(id: string, deleted_by?: string): Promise<void> {
  // Get account before deletion for audit
  const account = await getAccount(id);
  if (!account) {
    throw new Error('Account not found');
  }

  const result = await query('DELETE FROM accounts WHERE id = $1', [id]);

  if (result.rowCount === 0) {
    throw new Error('Failed to delete account');
  }

  // Log audit
  await logAuditAction(
    account.workspace_id,
    deleted_by || null,
    'DELETE_ACCOUNT',
    'Account',
    id,
    account,
    null
  );
}
