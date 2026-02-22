/**
 * Sync Operations Test Script
 * Tests the synchronized CRUD operations across PostgreSQL and Neo4j
 */

import { getDb, closeDb } from './src/lib/db/postgres';
import { getNeo4j, closeNeo4j, executeQuery } from './src/lib/db/neo4j';
import { WorkspaceSyncService, ToolSyncService, PermissionSyncService } from './src/services/sync.service';
import { logger } from './src/lib/logger';

async function testSyncOperations() {
  console.log('Starting Sync Operations Tests...\n');

  try {
    // Test 1: Create Workspace
    console.log('TEST 1: Creating workspace...');
    let workspace;
    try {
      workspace = await WorkspaceSyncService.createWorkspace(
        'Test Workspace',
        'This is a test workspace'
      );
      console.log('✓ Workspace created:', workspace);

      // Verify in both databases
      const pgResult = await getDb().query('SELECT * FROM workspaces WHERE id = $1', [workspace.id]);
      const neo4jResult = await executeQuery('MATCH (w:Workspace {id: $id}) RETURN w', { id: workspace.id });

      console.log('✓ Found in PostgreSQL:', pgResult.rows.length > 0);
      console.log('✓ Found in Neo4j:', neo4jResult.records.length > 0);
      console.log('');
    } catch (error: any) {
      console.error('✗ Test 1 failed:', error.message);
      console.log('');
    }

    // Test 2: Update Workspace
    if (workspace) {
      console.log('TEST 2: Updating workspace...');
      try {
        const updated = await WorkspaceSyncService.updateWorkspace(
          workspace.id,
          { name: 'Updated Workspace', description: 'Updated description' }
        );
        console.log('✓ Workspace updated:', updated);

        const pgResult = await getDb().query('SELECT * FROM workspaces WHERE id = $1', [workspace.id]);
        const neo4jResult = await executeQuery('MATCH (w:Workspace {id: $id}) RETURN w.name', { id: workspace.id });

        console.log('✓ PG name:', pgResult.rows[0]?.name);
        console.log('✓ Neo4j name:', neo4jResult.records[0]?.get('w.name'));
        console.log('');
      } catch (error: any) {
        console.error('✗ Test 2 failed:', error.message);
        console.log('');
      }
    }

    // Test 3: Create Tool
    console.log('TEST 3: Creating tool...');
    let tool;
    try {
      tool = await ToolSyncService.createTool(
        'send_email',
        'Send Email',
        'Send email to users',
        {
          type: 'object',
          properties: {
            email: { type: 'string' },
            subject: { type: 'string' },
            body: { type: 'string' }
          },
          required: ['email', 'subject', 'body']
        }
      );
      console.log('✓ Tool created:', tool);

      const pgResult = await getDb().query('SELECT * FROM tools WHERE id = $1', [tool.id]);
      const neo4jResult = await executeQuery('MATCH (t:Tool {key: $key}) RETURN t', { key: 'send_email' });

      console.log('✓ Found in PostgreSQL:', pgResult.rows.length > 0);
      console.log('✓ Found in Neo4j:', neo4jResult.records.length > 0);
      console.log('');
    } catch (error: any) {
      console.error('✗ Test 3 failed:', error.message);
      console.log('');
    }

    // Test 4: Grant Permission
    if (workspace && tool) {
      console.log('TEST 4: Granting tool permission...');
      try {
        const permission = await PermissionSyncService.grantToolPermission(
          workspace.id,
          'send_email'
        );
        console.log('✓ Permission granted:', permission);

        const pgResult = await getDb().query(
          'SELECT * FROM workspace_tools WHERE workspace_id = $1 AND tool_id = $2',
          [workspace.id, tool.id]
        );
        const neo4jResult = await executeQuery(
          'MATCH (w:Workspace {id: $ws})-[r:CAN_USE]->(t:Tool {key: $key}) RETURN r',
          { ws: workspace.id, key: 'send_email' }
        );

        console.log('✓ Found in PostgreSQL:', pgResult.rows.length > 0);
        console.log('✓ Found in Neo4j:', neo4jResult.records.length > 0);
        console.log('');
      } catch (error: any) {
        console.error('✗ Test 4 failed:', error.message);
        console.log('');
      }
    }

    // Test 5: Delete Workspace (cascade)
    if (workspace) {
      console.log('TEST 5: Deleting workspace (cascade)...');
      try {
        await WorkspaceSyncService.deleteWorkspace(workspace.id);
        console.log('✓ Workspace deleted');

        const pgResult = await getDb().query('SELECT * FROM workspaces WHERE id = $1', [workspace.id]);
        const neo4jResult = await executeQuery('MATCH (w:Workspace {id: $id}) RETURN w', { id: workspace.id });

        console.log('✓ Removed from PostgreSQL:', pgResult.rows.length === 0);
        console.log('✓ Removed from Neo4j:', neo4jResult.records.length === 0);
        console.log('');
      } catch (error: any) {
        console.error('✗ Test 5 failed:', error.message);
        console.log('');
      }
    }

    console.log('All tests completed!');
  } catch (error) {
    console.error('Test suite error:', error);
  } finally {
    await closeDb();
    await closeNeo4j();
  }
}

testSyncOperations();
