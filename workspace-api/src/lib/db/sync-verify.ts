/**
 * Database Synchronization Verification Utility
 * 
 * Checks consistency between PostgreSQL and Neo4j
 * Useful for debugging and validation after migrations
 */

import { query } from './postgres';
import { executeQuery } from './neo4j';
import { logger } from '../logger';

/**
 * Verify workspace exists in both databases
 */
export async function verifyWorkspace(workspaceId: string): Promise<boolean> {
  try {
    // Check PostgreSQL
    const pgResult = await query(
      'SELECT id FROM workspaces WHERE id = $1',
      [workspaceId]
    );

    if (pgResult.rows.length === 0) {
      logger.warn(`Workspace ${workspaceId} not found in PostgreSQL`);
      return false;
    }

    // Check Neo4j
    const neo4jResult = await executeQuery(
      'MATCH (w:Workspace {id: $id}) RETURN w',
      { id: workspaceId }
    );

    if (neo4jResult.records.length === 0) {
      logger.warn(`Workspace ${workspaceId} not found in Neo4j`);
      return false;
    }

    return true;
  } catch (error) {
    logger.error(`Error verifying workspace ${workspaceId}: ${error}`);
    return false;
  }
}

/**
 * Verify tool exists in both databases
 */
export async function verifyTool(toolId: string): Promise<boolean> {
  try {
    // Check PostgreSQL
    const pgResult = await query('SELECT id FROM tools WHERE id = $1', [toolId]);

    if (pgResult.rows.length === 0) {
      logger.warn(`Tool ${toolId} not found in PostgreSQL`);
      return false;
    }

    // Check Neo4j
    const neo4jResult = await executeQuery(
      'MATCH (t:Tool {id: $id}) RETURN t',
      { id: toolId }
    );

    if (neo4jResult.records.length === 0) {
      logger.warn(`Tool ${toolId} not found in Neo4j`);
      return false;
    }

    return true;
  } catch (error) {
    logger.error(`Error verifying tool ${toolId}: ${error}`);
    return false;
  }
}

/**
 * Verify workspace-tool permission exists in both databases
 */
export async function verifyToolPermission(
  workspaceId: string,
  toolId: string
): Promise<boolean> {
  try {
    // Check PostgreSQL
    const pgResult = await query(
      'SELECT id FROM workspace_tools WHERE workspace_id = $1 AND tool_id = $2',
      [workspaceId, toolId]
    );

    if (pgResult.rows.length === 0) {
      logger.warn(
        `Permission not found in PostgreSQL: workspace ${workspaceId} -> tool ${toolId}`
      );
      return false;
    }

    // Check Neo4j
    const neo4jResult = await executeQuery(
      `MATCH (w:Workspace {id: $workspace_id})-[:CAN_USE]->(t:Tool {id: $tool_id})
       RETURN count(*) as count`,
      { workspace_id: workspaceId, tool_id: toolId }
    );

    const count = neo4jResult.records[0]?.get('count');
    if (!count || count.toNumber() === 0) {
      logger.warn(
        `Permission not found in Neo4j: workspace ${workspaceId} -> tool ${toolId}`
      );
      return false;
    }

    return true;
  } catch (error) {
    logger.error(
      `Error verifying tool permission (${workspaceId} -> ${toolId}): ${error}`
    );
    return false;
  }
}

/**
 * Verify all workspaces exist in both databases
 */
export async function verifyAllWorkspaces(): Promise<{
  total: number;
  consistent: number;
  inconsistent: Array<{ id: string; location: 'pg' | 'neo4j' }>;
}> {
  try {
    // Get all workspaces from PostgreSQL
    const pgResult = await query('SELECT id FROM workspaces ORDER BY id');
    const pgIds = new Set(pgResult.rows.map((r) => r.id));

    // Get all workspaces from Neo4j
    const neo4jResult = await executeQuery(
      'MATCH (w:Workspace) RETURN w.id as id ORDER BY id'
    );
    const neo4jIds = new Set(neo4jResult.records.map((r) => r.get('id')));

    const inconsistent: Array<{ id: string; location: 'pg' | 'neo4j' }> = [];

    // Find missing in Neo4j
    pgIds.forEach((id) => {
      if (!neo4jIds.has(id)) {
        inconsistent.push({ id, location: 'neo4j' });
      }
    });

    // Find missing in PostgreSQL
    neo4jIds.forEach((id) => {
      if (!pgIds.has(id)) {
        inconsistent.push({ id, location: 'pg' });
      }
    });

    return {
      total: pgIds.size,
      consistent: pgIds.size - inconsistent.filter((i) => i.location === 'neo4j').length,
      inconsistent,
    };
  } catch (error) {
    logger.error(`Error verifying all workspaces: ${error}`);
    throw error;
  }
}

/**
 * Verify all tools exist in both databases
 */
export async function verifyAllTools(): Promise<{
  total: number;
  consistent: number;
  inconsistent: Array<{ id: string; location: 'pg' | 'neo4j' }>;
}> {
  try {
    // Get all tools from PostgreSQL
    const pgResult = await query('SELECT id FROM tools ORDER BY id');
    const pgIds = new Set(pgResult.rows.map((r) => r.id));

    // Get all tools from Neo4j
    const neo4jResult = await executeQuery(
      'MATCH (t:Tool) RETURN t.id as id ORDER BY id'
    );
    const neo4jIds = new Set(neo4jResult.records.map((r) => r.get('id')));

    const inconsistent: Array<{ id: string; location: 'pg' | 'neo4j' }> = [];

    // Find missing in Neo4j
    pgIds.forEach((id) => {
      if (!neo4jIds.has(id)) {
        inconsistent.push({ id, location: 'neo4j' });
      }
    });

    // Find missing in PostgreSQL
    neo4jIds.forEach((id) => {
      if (!pgIds.has(id)) {
        inconsistent.push({ id, location: 'pg' });
      }
    });

    return {
      total: pgIds.size,
      consistent: pgIds.size - inconsistent.filter((i) => i.location === 'neo4j').length,
      inconsistent,
    };
  } catch (error) {
    logger.error(`Error verifying all tools: ${error}`);
    throw error;
  }
}

/**
 * Verify all workspace-tool permissions exist in both databases
 */
export async function verifyAllPermissions(): Promise<{
  total: number;
  consistent: number;
  inconsistent: Array<{
    workspace_id: string;
    tool_id: string;
    location: 'pg' | 'neo4j';
  }>;
}> {
  try {
    // Get all permissions from PostgreSQL
    const pgResult = await query(
      `SELECT workspace_id, tool_id FROM workspace_tools 
       ORDER BY workspace_id, tool_id`
    );
    const pgPerms = new Set(
      pgResult.rows.map((r) => `${r.workspace_id}:${r.tool_id}`)
    );

    // Get all permissions from Neo4j
    const neo4jResult = await executeQuery(
      `MATCH (w:Workspace)-[:CAN_USE]->(t:Tool)
       RETURN w.id as workspace_id, t.id as tool_id
       ORDER BY workspace_id, tool_id`
    );
    const neo4jPerms = new Set(
      neo4jResult.records.map(
        (r) => `${r.get('workspace_id')}:${r.get('tool_id')}`
      )
    );

    const inconsistent: Array<{
      workspace_id: string;
      tool_id: string;
      location: 'pg' | 'neo4j';
    }> = [];

    // Find missing in Neo4j
    pgPerms.forEach((perm) => {
      if (!neo4jPerms.has(perm)) {
        const [workspace_id, tool_id] = perm.split(':');
        inconsistent.push({ workspace_id, tool_id, location: 'neo4j' });
      }
    });

    // Find missing in PostgreSQL
    neo4jPerms.forEach((perm) => {
      if (!pgPerms.has(perm)) {
        const [workspace_id, tool_id] = perm.split(':');
        inconsistent.push({ workspace_id, tool_id, location: 'pg' });
      }
    });

    return {
      total: pgPerms.size,
      consistent:
        pgPerms.size - inconsistent.filter((i) => i.location === 'neo4j').length,
      inconsistent,
    };
  } catch (error) {
    logger.error(`Error verifying all permissions: ${error}`);
    throw error;
  }
}

/**
 * Full consistency check
 */
export async function verifyFullConsistency(): Promise<{
  workspaces: Awaited<ReturnType<typeof verifyAllWorkspaces>>;
  tools: Awaited<ReturnType<typeof verifyAllTools>>;
  permissions: Awaited<ReturnType<typeof verifyAllPermissions>>;
  isConsistent: boolean;
}> {
  try {
    logger.info('Starting full database consistency check...');

    const [workspaces, tools, permissions] = await Promise.all([
      verifyAllWorkspaces(),
      verifyAllTools(),
      verifyAllPermissions(),
    ]);

    const isConsistent =
      workspaces.inconsistent.length === 0 &&
      tools.inconsistent.length === 0 &&
      permissions.inconsistent.length === 0;

    const result = {
      workspaces,
      tools,
      permissions,
      isConsistent,
    };

    if (isConsistent) {
      logger.info('✓ Full consistency check passed');
    } else {
      logger.warn('✗ Inconsistencies detected in database sync');
      if (workspaces.inconsistent.length > 0) {
        logger.warn(`  - Workspace inconsistencies: ${workspaces.inconsistent.length}`);
      }
      if (tools.inconsistent.length > 0) {
        logger.warn(`  - Tool inconsistencies: ${tools.inconsistent.length}`);
      }
      if (permissions.inconsistent.length > 0) {
        logger.warn(`  - Permission inconsistencies: ${permissions.inconsistent.length}`);
      }
    }

    return result;
  } catch (error) {
    logger.error(`Error during consistency check: ${error}`);
    throw error;
  }
}

/**
 * Auto-repair workspace sync
 * Only create missing Neo4j records (safer operation)
 */
export async function repairWorkspacesNeo4j(): Promise<{ repaired: number; errors: number }> {
  try {
    logger.info('Starting workspace Neo4j repair...');

    // Get all workspaces from PostgreSQL
    const pgResult = await query('SELECT id, name FROM workspaces');
    const pgWorkspaces = new Map(pgResult.rows.map((r) => [r.id, r.name]));

    // Get all workspaces from Neo4j
    const neo4jResult = await executeQuery(
      'MATCH (w:Workspace) RETURN w.id as id'
    );
    const neo4jIds = new Set(neo4jResult.records.map((r) => r.get('id')));

    let repaired = 0;
    let errors = 0;

    // Create missing Neo4j records
    for (const [id, name] of pgWorkspaces.entries()) {
      if (!neo4jIds.has(id)) {
        try {
          await executeQuery(
            `CREATE (w:Workspace {id: $id, name: $name, created_at: datetime()})
             RETURN w`,
            { id, name }
          );
          repaired++;
          logger.info(`  ✓ Repaired workspace ${id}`);
        } catch (error) {
          errors++;
          logger.error(`  ✗ Failed to repair workspace ${id}: ${error}`);
        }
      }
    }

    logger.info(`Workspace repair completed: ${repaired} repaired, ${errors} errors`);
    return { repaired, errors };
  } catch (error) {
    logger.error(`Error during workspace repair: ${error}`);
    throw error;
  }
}

/**
 * Auto-repair tool sync
 * Only create missing Neo4j records (safer operation)
 */
export async function repairToolsNeo4j(): Promise<{ repaired: number; errors: number }> {
  try {
    logger.info('Starting tool Neo4j repair...');

    // Get all tools from PostgreSQL
    const pgResult = await query('SELECT id, key, name FROM tools');
    const pgTools = new Map(
      pgResult.rows.map((r) => [r.id, { key: r.key, name: r.name }])
    );

    // Get all tools from Neo4j
    const neo4jResult = await executeQuery('MATCH (t:Tool) RETURN t.id as id');
    const neo4jIds = new Set(neo4jResult.records.map((r) => r.get('id')));

    let repaired = 0;
    let errors = 0;

    // Create missing Neo4j records
    for (const [id, { key, name }] of pgTools.entries()) {
      if (!neo4jIds.has(id)) {
        try {
          await executeQuery(
            `CREATE (t:Tool {id: $id, key: $key, name: $name, created_at: datetime()})
             RETURN t`,
            { id, key, name }
          );
          repaired++;
          logger.info(`  ✓ Repaired tool ${id}`);
        } catch (error) {
          errors++;
          logger.error(`  ✗ Failed to repair tool ${id}: ${error}`);
        }
      }
    }

    logger.info(`Tool repair completed: ${repaired} repaired, ${errors} errors`);
    return { repaired, errors };
  } catch (error) {
    logger.error(`Error during tool repair: ${error}`);
    throw error;
  }
}
