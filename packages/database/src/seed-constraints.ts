import dotenv from 'dotenv';
import { runCypher, getNeo4jDriver } from './neo4j.js';

dotenv.config();

const CONSTRAINTS = [
  'CREATE CONSTRAINT unique_workspace_id IF NOT EXISTS FOR (w:Workspace) REQUIRE w.id IS UNIQUE',
  'CREATE CONSTRAINT unique_workspace_webhook_id IF NOT EXISTS FOR (wh:WorkspaceWebhook) REQUIRE wh.id IS UNIQUE',
  'CREATE CONSTRAINT unique_channel_chat_id IF NOT EXISTS FOR (c:ChannelChat) REQUIRE c.id IS UNIQUE',
  'CREATE CONSTRAINT unique_channel_chat_platform IF NOT EXISTS FOR (c:ChannelChat) REQUIRE (c.platform, c.platform_chat_id) IS UNIQUE',
  'CREATE CONSTRAINT unique_tool_group_id IF NOT EXISTS FOR (tg:ToolGroup) REQUIRE tg.id IS UNIQUE',
  'CREATE CONSTRAINT unique_tool_group_key IF NOT EXISTS FOR (tg:ToolGroup) REQUIRE tg.key IS UNIQUE',
  'CREATE CONSTRAINT unique_tool_id IF NOT EXISTS FOR (t:Tool) REQUIRE t.id IS UNIQUE',
  'CREATE CONSTRAINT unique_tool_key IF NOT EXISTS FOR (t:Tool) REQUIRE t.key IS UNIQUE',
  'CREATE CONSTRAINT unique_skill_id IF NOT EXISTS FOR (s:Skill) REQUIRE s.id IS UNIQUE',
  'CREATE CONSTRAINT unique_skill_key IF NOT EXISTS FOR (s:Skill) REQUIRE s.key IS UNIQUE',
];

export async function seedNeo4jConstraints(): Promise<void> {
  console.log('--- Applying Neo4j Schema Constraints ---');
  for (const query of CONSTRAINTS) {
    try {
      await runCypher(query);
      console.log(`✓ Executed: ${query}`);
    } catch (error) {
      console.error(`✗ Error executing: ${query}`, error);
    }
  }
  console.log('--- Neo4j Constraints Initialized Successfully ---');
}

import { fileURLToPath } from 'url';
import path from 'path';

// Auto-run if executed directly
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  seedNeo4jConstraints()
    .then(async () => {
      const driver = getNeo4jDriver();
      await driver.close();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal error seeding Neo4j constraints:', err);
      process.exit(1);
    });
}
