/**
 * Sync Service
 * 
 * Manages synchronized CRUD operations across PostgreSQL and Neo4j
 * Ensures consistency between relational and graph databases
 */

import { Pool, PoolClient } from 'pg';
import { executeQuery, getNeo4j } from '@/lib/db';
import { getDb, transaction } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * Base transaction class for atomic operations
 */
export class SyncTransaction {
  private pgClient: PoolClient | null = null;
  private neo4jSession: any = null;
  private neo4jTxn: any = null;

  async begin() {
    const pool = getDb();
    this.pgClient = await pool.connect();

    try {
      const driver = getNeo4j();
      this.neo4jSession = driver.session();
      this.neo4jTxn = this.neo4jSession.beginTransaction();

      // Start PostgreSQL transaction
      await this.pgClient.query('BEGIN');
    } catch (error) {
      // Cleanup PostgreSQL connection if Neo4j setup fails
      if (this.pgClient) {
        this.pgClient.release();
        this.pgClient = null;
      }
      if (this.neo4jSession) {
        await this.neo4jSession.close();
        this.neo4jSession = null;
      }
      logger.error('Failed to begin transaction:', error);
      throw error;
    }
  }

  async commit() {
    try {
      // Commit Neo4j first (more likely to fail)
      if (this.neo4jTxn) {
        await this.neo4jTxn.commit();
      }
      // Then commit PostgreSQL
      if (this.pgClient) {
        await this.pgClient.query('COMMIT');
      }
      logger.info('Transaction committed successfully');
    } catch (error) {
      logger.error('Commit failed, rolling back:', error);
      await this.rollback();
      throw error;
    } finally {
      this.cleanup();
    }
  }

  async rollback() {
    try {
      // Rollback Neo4j first
      if (this.neo4jTxn) {
        try {
          await this.neo4jTxn.rollback();
        } catch (neo4jError) {
          logger.warn('Neo4j rollback failed (may already be rolled back):', neo4jError);
        }
      }
      // Then rollback PostgreSQL
      if (this.pgClient) {
        await this.pgClient.query('ROLLBACK');
      }
      logger.info('Transaction rolled back');
    } catch (error) {
      logger.error('Rollback failed:', error);
      // Continue with cleanup even if rollback fails
    } finally {
      this.cleanup();
    }
  }

  private cleanup() {
    if (this.pgClient) {
      this.pgClient.release();
      this.pgClient = null;
    }
    if (this.neo4jSession) {
      this.neo4jSession.close();
      this.neo4jSession = null;
    }
    this.neo4jTxn = null;
  }

  async pgQuery(text: string, params: any[] = []) {
    if (!this.pgClient) {
      throw new Error('PostgreSQL transaction not started');
    }
    return this.pgClient.query(text, params);
  }

  async neo4jRun(query: string, params: Record<string, any> = {}) {
    if (!this.neo4jTxn) {
      throw new Error('Neo4j transaction not initialized');
    }
    return this.neo4jTxn.run(query, params);
  }
}

/**
 * Workspace Sync Operations
 */
export class WorkspaceSyncService {
  /**
   * Create workspace with full sync
   */
  static async createWorkspace(
    name: string,
    description?: string,
    created_by?: string
  ) {
    const txn = new SyncTransaction();
    try {
      await txn.begin();

      // 1. Create in PostgreSQL
      const pgResult = await txn.pgQuery(
        `INSERT INTO workspaces (name, description, status, created_at, updated_at)
         VALUES ($1, $2, 'active', NOW(), NOW())
         RETURNING id, name, status, description, created_at, updated_at`,
        [name, description || null]
      );

      if (pgResult.rows.length === 0) {
        throw new Error('Failed to create workspace in PostgreSQL');
      }

      const workspace = pgResult.rows[0];

      // 2. Create in Neo4j
      const neo4jResult = await txn.neo4jRun(
        `CREATE (w:Workspace {
          id: $id,
          name: $name
        })
        RETURN w`,
        {
          id: workspace.id,
          name: workspace.name,
        }
      );

      if (neo4jResult.records.length === 0) {
        throw new Error('Failed to create workspace in Neo4j');
      }

      await txn.commit();
      logger.info(`Workspace created successfully: ${workspace.id}`);
      return workspace;
    } catch (error) {
      await txn.rollback();
      logger.error(`Failed to create workspace: ${error}`);
      throw error;
    }
  }

  /**
   * Update workspace with full sync
   */
  static async updateWorkspace(
    id: string,
    updates: { name?: string; description?: string; status?: string },
    updated_by?: string
  ) {
    const txn = new SyncTransaction();
    try {
      await txn.begin();

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
      if (updates.status !== undefined) {
        fields.push(`status = $${paramIndex++}`);
        values.push(updates.status);
      }

      if (fields.length === 0) {
        const result = await txn.pgQuery(
          'SELECT * FROM workspaces WHERE id = $1',
          [id]
        );
        return result.rows[0];
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      // 1. Update in PostgreSQL
      const pgResult = await txn.pgQuery(
        `UPDATE workspaces
         SET ${fields.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, name, status, description, created_at, updated_at`,
        values
      );

      if (pgResult.rows.length === 0) {
        throw new Error('Workspace not found in PostgreSQL');
      }

      const workspace = pgResult.rows[0];

      // 2. Update in Neo4j
      const updateFields: string[] = [];
      const neo4jParams: Record<string, any> = { id };

      if (updates.name !== undefined) {
        updateFields.push('w.name = $name');
        neo4jParams.name = updates.name;
      }

      // Removed status update from Neo4j

      if (updateFields.length > 0) {
        const neo4jResult = await txn.neo4jRun(
          `MATCH (w:Workspace {id: $id})
           SET ${updateFields.join(', ')}
           RETURN w`,
          neo4jParams
        );

        if (neo4jResult.records.length === 0) {
          throw new Error('Workspace not found in Neo4j');
        }
      }

      await txn.commit();
      logger.info(`Workspace updated successfully: ${id}`);
      return workspace;
    } catch (error) {
      await txn.rollback();
      logger.error(`Failed to update workspace: ${error}`);
      throw error;
    }
  }

  /**
   * Delete workspace with full sync (cascade delete)
   */
  static async deleteWorkspace(id: string, deleted_by?: string) {
    const txn = new SyncTransaction();
    try {
      await txn.begin();

      // Get workspace data before deletion
      const getResult = await txn.pgQuery(
        'SELECT * FROM workspaces WHERE id = $1',
        [id]
      );

      if (getResult.rows.length === 0) {
        throw new Error('Workspace not found');
      }

      const workspace = getResult.rows[0];

      // 1. Delete related zalo_groups from PostgreSQL
      await txn.pgQuery('DELETE FROM zalo_groups WHERE workspace_id = $1', [id]);

      // 2. Delete workspace from PostgreSQL (cascade will handle workspace_tools, etc)
      await txn.pgQuery('DELETE FROM workspaces WHERE id = $1', [id]);

      // 3. Delete from Neo4j (cascade delete all relationships)
      const neo4jResult = await txn.neo4jRun(
        `MATCH (w:Workspace {id: $id})
         OPTIONAL MATCH (w)-[r]-()
         DELETE r, w
         RETURN count(r) as relationshipCount`,
        { id }
      );

      if (neo4jResult.records.length === 0) {
        logger.warn(`Workspace ${id} not found in Neo4j, but continuing`);
      }

      await txn.commit();
      logger.info(`Workspace deleted successfully: ${id}`);
      return workspace;
    } catch (error) {
      await txn.rollback();
      logger.error(`Failed to delete workspace: ${error}`);
      throw error;
    }
  }
}

/**
 * Tool Sync Operations
 */
export class ToolSyncService {
  /**
   * Create tool with full sync
   */
  static async createTool(
    key: string,
    name: string,
    description?: string,
    input_schema?: any,
    embedding?: number[],
    created_by?: string
  ) {
    const txn = new SyncTransaction();
    try {
      await txn.begin();

      // 1. Create in PostgreSQL
      const pgResult = await txn.pgQuery(
        `INSERT INTO tools (key, name, description, input_schema, embedding, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'active', NOW(), NOW())
         RETURNING id, key, name, description, input_schema, embedding, status, created_at, updated_at`,
        [
          key,
          name,
          description || null,
          input_schema ? JSON.stringify(input_schema) : null,
          embedding ? JSON.stringify(embedding) : null,
        ]
      );

      if (pgResult.rows.length === 0) {
        throw new Error('Failed to create tool in PostgreSQL');
      }

      const tool = pgResult.rows[0];

      // 2. Create in Neo4j
      const neo4jResult = await txn.neo4jRun(
        `CREATE (t:Tool {
          id: $id,
          key: $key,
          name: $name
        })
        RETURN t`,
        {
          id: tool.id,
          key: tool.key,
          name: tool.name,
        }
      );

      if (neo4jResult.records.length === 0) {
        throw new Error('Failed to create tool in Neo4j');
      }

      await txn.commit();
      logger.info(`Tool created successfully: ${tool.id}`);
      return tool;
    } catch (error) {
      await txn.rollback();
      logger.error(`Failed to create tool: ${error}`);
      throw error;
    }
  }

  /**
   * Update tool with full sync
   */
  static async updateTool(
    id: string,
    updates: {
      name?: string;
      description?: string;
      input_schema?: any;
      embedding?: number[];
      status?: string;
    },
    updated_by?: string
  ) {
    const txn = new SyncTransaction();
    try {
      await txn.begin();

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
      if (updates.input_schema !== undefined) {
        fields.push(`input_schema = $${paramIndex++}`);
        values.push(updates.input_schema ? JSON.stringify(updates.input_schema) : null);
      }
      if (updates.embedding !== undefined) {
        fields.push(`embedding = $${paramIndex++}`);
        values.push(updates.embedding ? JSON.stringify(updates.embedding) : null);
      }
      if (updates.status !== undefined) {
        fields.push(`status = $${paramIndex++}`);
        values.push(updates.status);
      }

      if (fields.length === 0) {
        const result = await txn.pgQuery('SELECT * FROM tools WHERE id = $1', [id]);
        return result.rows[0];
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      // 1. Update in PostgreSQL
      const pgResult = await txn.pgQuery(
        `UPDATE tools
         SET ${fields.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, key, name, description, input_schema, embedding, status, created_at, updated_at`,
        values
      );

      if (pgResult.rows.length === 0) {
        throw new Error('Tool not found in PostgreSQL');
      }

      const tool = pgResult.rows[0];

      // 2. Update in Neo4j
      const updateFields: string[] = [];
      const neo4jParams: Record<string, any> = { id };

      if (updates.name !== undefined) {
        updateFields.push('t.name = $name');
        neo4jParams.name = updates.name;
      }

      // Removed status update from Neo4j

      if (updateFields.length > 0) {
        const neo4jResult = await txn.neo4jRun(
          `MATCH (t:Tool {id: $id})
           SET ${updateFields.join(', ')}
           RETURN t`,
          neo4jParams
        );

        if (neo4jResult.records.length === 0) {
          throw new Error('Tool not found in Neo4j');
        }
      }

      await txn.commit();
      logger.info(`Tool updated successfully: ${id}`);
      return tool;
    } catch (error) {
      await txn.rollback();
      logger.error(`Failed to update tool: ${error}`);
      throw error;
    }
  }

  /**
   * Delete tool with full sync
   */
  static async deleteTool(id: string, deleted_by?: string) {
    const txn = new SyncTransaction();
    try {
      await txn.begin();

      // Get tool data before deletion
      const getResult = await txn.pgQuery('SELECT * FROM tools WHERE id = $1', [id]);

      if (getResult.rows.length === 0) {
        throw new Error('Tool not found');
      }

      const tool = getResult.rows[0];

      // 1. Delete from PostgreSQL (cascade will remove workspace_tools, etc)
      await txn.pgQuery('DELETE FROM tools WHERE id = $1', [id]);

      // 2. Delete from Neo4j
      const neo4jResult = await txn.neo4jRun(
        `MATCH (t:Tool {id: $id})
         OPTIONAL MATCH (t)-[r]-()
         DELETE r, t
         RETURN count(r) as relationshipCount`,
        { id }
      );

      if (neo4jResult.records.length === 0) {
        logger.warn(`Tool ${id} not found in Neo4j, but continuing`);
      }

      await txn.commit();
      logger.info(`Tool deleted successfully: ${id}`);
      return tool;
    } catch (error) {
      await txn.rollback();
      logger.error(`Failed to delete tool: ${error}`);
      throw error;
    }
  }
}

/**
 * Zalo Group Sync Operations
 */
export class ZaloGroupSyncService {
  /**
   * Create zalo group with full sync
   */
  static async createZaloGroup(
    workspace_id: string,
    thread_id: string,
    name?: string,
    created_by?: string
  ) {
    const txn = new SyncTransaction();
    try {
      await txn.begin();

      // 1. Check if group already exists with different workspace
      const existCheck = await txn.pgQuery(
        'SELECT id, workspace_id FROM zalo_groups WHERE thread_id = $1',
        [thread_id]
      );

      if (existCheck.rows.length > 0 && existCheck.rows[0].workspace_id !== workspace_id) {
        throw new Error(
          `Zalo group ${thread_id} already belongs to workspace ${existCheck.rows[0].workspace_id}`
        );
      }

      // 2. Create in PostgreSQL
      const pgResult = await txn.pgQuery(
        `INSERT INTO zalo_groups (workspace_id, thread_id, name, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'active', NOW(), NOW())
         RETURNING id, workspace_id, thread_id, name, status, created_at, updated_at`,
        [workspace_id, thread_id, name || null]
      );

      if (pgResult.rows.length === 0) {
        throw new Error('Failed to create zalo group in PostgreSQL');
      }

      const group = pgResult.rows[0];

      // 3. Create in Neo4j and establish relationships
      const neo4jResult = await txn.neo4jRun(
        `MATCH (w:Workspace {id: $workspace_id})
         CREATE (g:ZaloGroup {
           id: $id,
           thread_id: $thread_id,
           name: $name
         })
         CREATE (g)-[:BELONGS_TO]->(w)
         RETURN g`,
        {
          id: group.id,
          workspace_id,
          thread_id,
          name: name || null,
        }
      );

      if (neo4jResult.records.length === 0) {
        throw new Error('Failed to create zalo group in Neo4j');
      }

      await txn.commit();
      logger.info(`Zalo group created successfully: ${group.id}`);
      return group;
    } catch (error) {
      await txn.rollback();
      logger.error(`Failed to create zalo group: ${error}`);
      throw error;
    }
  }

  /**
   * Update zalo group with full sync
   */
  static async updateZaloGroup(
    id: string,
    updates: { name?: string; status?: string },
    updated_by?: string
  ) {
    const txn = new SyncTransaction();
    try {
      await txn.begin();

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

      if (fields.length === 0) {
        const result = await txn.pgQuery(
          'SELECT * FROM zalo_groups WHERE id = $1',
          [id]
        );
        return result.rows[0];
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      // 1. Update in PostgreSQL
      const pgResult = await txn.pgQuery(
        `UPDATE zalo_groups
         SET ${fields.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, workspace_id, thread_id, name, status, created_at, updated_at`,
        values
      );

      if (pgResult.rows.length === 0) {
        throw new Error('Zalo group not found in PostgreSQL');
      }

      const group = pgResult.rows[0];

      // 2. Update in Neo4j
      const updateFields: string[] = [];
      const neo4jParams: Record<string, any> = { id };

      if (updates.name !== undefined) {
        updateFields.push('g.name = $name');
        neo4jParams.name = updates.name;
      }

      // Removed status update from Neo4j

      if (updateFields.length > 0) {
        const neo4jResult = await txn.neo4jRun(
          `MATCH (g:ZaloGroup {id: $id})
           SET ${updateFields.join(', ')}
           RETURN g`,
          neo4jParams
        );

        if (neo4jResult.records.length === 0) {
          throw new Error('Zalo group not found in Neo4j');
        }
      }

      await txn.commit();
      logger.info(`Zalo group updated successfully: ${id}`);
      return group;
    } catch (error) {
      await txn.rollback();
      logger.error(`Failed to update zalo group: ${error}`);
      throw error;
    }
  }

  /**
   * Delete zalo group with full sync
   */
  static async deleteZaloGroup(id: string, deleted_by?: string) {
    const txn = new SyncTransaction();
    try {
      await txn.begin();

      // Get group data before deletion
      const getResult = await txn.pgQuery(
        'SELECT * FROM zalo_groups WHERE id = $1',
        [id]
      );

      if (getResult.rows.length === 0) {
        throw new Error('Zalo group not found');
      }

      const group = getResult.rows[0];

      // 1. Delete from PostgreSQL
      await txn.pgQuery('DELETE FROM zalo_groups WHERE id = $1', [id]);

      // 2. Delete from Neo4j
      const neo4jResult = await txn.neo4jRun(
        `MATCH (g:ZaloGroup {id: $id})
         OPTIONAL MATCH (g)-[r]-()
         DELETE r, g
         RETURN count(r) as relationshipCount`,
        { id }
      );

      if (neo4jResult.records.length === 0) {
        logger.warn(`Zalo group ${id} not found in Neo4j, but continuing`);
      }

      await txn.commit();
      logger.info(`Zalo group deleted successfully: ${id}`);
      return group;
    } catch (error) {
      await txn.rollback();
      logger.error(`Failed to delete zalo group: ${error}`);
      throw error;
    }
  }
}

/**
 * Permission Sync Operations
 */
export class PermissionSyncService {
  /**
   * Grant tool permission to workspace
   */
  static async grantToolPermission(
    workspace_id: string,
    tool_key: string,
    granted_by?: string
  ) {
    const txn = new SyncTransaction();
    try {
      await txn.begin();

      // 1. Verify workspace exists
      const wsCheck = await txn.pgQuery(
        'SELECT id FROM workspaces WHERE id = $1',
        [workspace_id]
      );
      if (wsCheck.rows.length === 0) {
        throw new Error(`Workspace ${workspace_id} not found`);
      }

      // 2. Verify tool exists
      const toolCheck = await txn.pgQuery(
        'SELECT id FROM tools WHERE key = $1',
        [tool_key]
      );
      if (toolCheck.rows.length === 0) {
        throw new Error(`Tool ${tool_key} not found`);
      }

      const tool_id = toolCheck.rows[0].id;

      // 3. Check if permission already exists
      const permCheck = await txn.pgQuery(
        'SELECT id FROM workspace_tools WHERE workspace_id = $1 AND tool_id = $2',
        [workspace_id, tool_id]
      );

      if (permCheck.rows.length > 0) {
        logger.info(`Permission already exists: workspace ${workspace_id} -> tool ${tool_key}`);
        return { workspace_id, tool_id, status: 'already_exists' };
      }

      // 4. Create in PostgreSQL
      const pgResult = await txn.pgQuery(
        `INSERT INTO workspace_tools (workspace_id, tool_id, created_at)
         VALUES ($1, $2, NOW())
         RETURNING id, workspace_id, tool_id, created_at`,
        [workspace_id, tool_id]
      );

      if (pgResult.rows.length === 0) {
        throw new Error('Failed to create permission in PostgreSQL');
      }

      const permission = pgResult.rows[0];

      // 5. Create relationship in Neo4j
      const neo4jResult = await txn.neo4jRun(
        `MATCH (w:Workspace {id: $workspace_id})
         MATCH (t:Tool {key: $tool_key})
         MERGE (w)-[rel:CAN_USE]->(t)
         SET rel.created_at = datetime()
         RETURN rel`,
        {
          workspace_id,
          tool_key,
        }
      );

      if (neo4jResult.records.length === 0) {
        throw new Error('Failed to create permission in Neo4j');
      }

      await txn.commit();
      logger.info(`Permission granted: workspace ${workspace_id} -> tool ${tool_key}`);
      return { ...permission, status: 'granted' };
    } catch (error) {
      await txn.rollback();
      logger.error(`Failed to grant tool permission: ${error}`);
      throw error;
    }
  }

  /**
   * Revoke tool permission from workspace
   */
  static async revokeToolPermission(
    workspace_id: string,
    tool_key: string,
    revoked_by?: string
  ) {
    const txn = new SyncTransaction();
    try {
      await txn.begin();

      // 1. Get tool ID
      const toolResult = await txn.pgQuery(
        'SELECT id FROM tools WHERE key = $1',
        [tool_key]
      );

      if (toolResult.rows.length === 0) {
        throw new Error(`Tool ${tool_key} not found`);
      }

      const tool_id = toolResult.rows[0].id;

      // 2. Delete from PostgreSQL
      const delResult = await txn.pgQuery(
        'DELETE FROM workspace_tools WHERE workspace_id = $1 AND tool_id = $2 RETURNING id',
        [workspace_id, tool_id]
      );

      if (delResult.rows.length === 0) {
        throw new Error('Permission not found');
      }

      // 3. Delete from Neo4j
      const neo4jResult = await txn.neo4jRun(
        `MATCH (w:Workspace {id: $workspace_id})-[rel:CAN_USE]->(t:Tool {key: $tool_key})
         DELETE rel
         RETURN count(rel) as deleted`,
        {
          workspace_id,
          tool_key,
        }
      );

      if (neo4jResult.records.length === 0 || neo4jResult.records[0].get('deleted') === 0) {
        logger.warn(
          `Permission not found in Neo4j: workspace ${workspace_id} -> tool ${tool_key}`
        );
      }

      await txn.commit();
      logger.info(`Permission revoked: workspace ${workspace_id} -> tool ${tool_key}`);
      return { workspace_id, tool_key, status: 'revoked' };
    } catch (error) {
      await txn.rollback();
      logger.error(`Failed to revoke tool permission: ${error}`);
      throw error;
    }
  }

  /**
   * Assign user role in workspace
   */
  static async assignUserRole(
    workspace_id: string,
    user_id: string,
    role: string,
    assigned_by?: string
  ) {
    const txn = new SyncTransaction();
    try {
      await txn.begin();

      const validRoles = ['ADMIN', 'MEMBER'];
      if (!validRoles.includes(role)) {
        throw new Error(`Invalid role: ${role}`);
      }

      // 1. Check if assignment already exists
      const existCheck = await txn.pgQuery(
        'SELECT id FROM workspace_user_roles WHERE workspace_id = $1 AND user_id = $2',
        [workspace_id, user_id]
      );

      let roleRecord;

      if (existCheck.rows.length > 0) {
        // Update existing
        const updateResult = await txn.pgQuery(
          `UPDATE workspace_user_roles
           SET role = $1, assigned_by = $2, updated_at = NOW()
           WHERE workspace_id = $3 AND user_id = $4
           RETURNING id, workspace_id, user_id, role, assigned_by, created_at, updated_at`,
          [role, assigned_by || null, workspace_id, user_id]
        );
        roleRecord = updateResult.rows[0];
      } else {
        // Create new
        const createResult = await txn.pgQuery(
          `INSERT INTO workspace_user_roles (workspace_id, user_id, role, assigned_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           RETURNING id, workspace_id, user_id, role, assigned_by, created_at, updated_at`,
          [workspace_id, user_id, role, assigned_by || null]
        );
        roleRecord = createResult.rows[0];
      }

      // 2. Update/Create in Neo4j
      const neo4jResult = await txn.neo4jRun(
        `MATCH (u:ZaloUser {id: $user_id})
         MATCH (w:Workspace {id: $workspace_id})
         MERGE (u)-[r:HAS_ROLE {role: $role}]->(w)
         SET r.updated_at = datetime()
         RETURN r`,
        {
          user_id,
          workspace_id,
          role,
        }
      );

      if (neo4jResult.records.length === 0) {
        throw new Error('Failed to update role in Neo4j');
      }

      await txn.commit();
      logger.info(
        `User role assigned: user ${user_id} -> workspace ${workspace_id} (${role})`
      );
      return roleRecord;
    } catch (error) {
      await txn.rollback();
      logger.error(`Failed to assign user role: ${error}`);
      throw error;
    }
  }

  /**
   * Remove user from workspace
   */
  static async removeUserFromWorkspace(
    workspace_id: string,
    user_id: string,
    removed_by?: string
  ) {
    const txn = new SyncTransaction();
    try {
      await txn.begin();

      // 1. Delete from PostgreSQL
      await txn.pgQuery(
        'DELETE FROM workspace_user_roles WHERE workspace_id = $1 AND user_id = $2',
        [workspace_id, user_id]
      );

      // 2. Delete from Neo4j
      const neo4jResult = await txn.neo4jRun(
        `MATCH (u:ZaloUser {id: $user_id})-[r:HAS_ROLE]->(w:Workspace {id: $workspace_id})
         DELETE r
         RETURN count(r) as deleted`,
        {
          user_id,
          workspace_id,
        }
      );

      if (neo4jResult.records.length === 0 || neo4jResult.records[0].get('deleted') === 0) {
        logger.warn(
          `User role not found in Neo4j: user ${user_id} -> workspace ${workspace_id}`
        );
      }

      await txn.commit();
      logger.info(`User removed from workspace: user ${user_id} <- workspace ${workspace_id}`);
      return { workspace_id, user_id, status: 'removed' };
    } catch (error) {
      await txn.rollback();
      logger.error(`Failed to remove user from workspace: ${error}`);
      throw error;
    }
  }
}
