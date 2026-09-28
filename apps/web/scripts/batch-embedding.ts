/**
 * Batch Embedding Generation Script
 * Generates embeddings for all tools, skills, and workspaces that don't have them
 * 
 * Usage: npx ts-node scripts/batch-embedding.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local first (local dev: localhost DB), then fallback to ../.env (docker env)
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Pool } from 'pg';
import { embeddingClient } from '../src/lib/embedding';
import { logger } from '../src/lib/logger';

async function main() {
  const db = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    logger.info('Starting batch embedding generation...');

    // -----------------------------------------------------------------------
    // Step 1: Tools
    // -----------------------------------------------------------------------
    logger.info('Processing tools...');
    const toolsResult = await db.query(
      "SELECT id, key, description FROM tools WHERE embedding IS NULL AND status = 'active'"
    );

    const tools = toolsResult.rows;
    logger.info(`Found ${tools.length} tools without embeddings`);

    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];
      try {
        if (!tool.description) {
          logger.warn(`Tool ${tool.key} has no description, skipping`);
          continue;
        }

        logger.info(`[${i + 1}/${tools.length}] Generating embedding for tool: ${tool.key}`);
        const embedding = await embeddingClient.generateEmbedding(tool.description);

        await db.query(
          'UPDATE tools SET embedding = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [JSON.stringify(embedding), tool.id]
        );

        logger.info(`✓ Tool ${tool.key} embedding saved`);

        // Add delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        logger.error(`Failed to process tool ${tool.key}: ${error}`);
      }
    }

    // -----------------------------------------------------------------------
    // Step 2: Skills
    // -----------------------------------------------------------------------
    logger.info('Processing skills...');
    const skillsResult = await db.query(
      "SELECT id, name, description FROM skills WHERE embedding IS NULL AND status = 'active'"
    );

    const skills = skillsResult.rows;
    logger.info(`Found ${skills.length} skills without embeddings`);

    for (let i = 0; i < skills.length; i++) {
      const skill = skills[i];
      try {
        const textToEmbed = skill.description || skill.name;

        logger.info(`[${i + 1}/${skills.length}] Generating embedding for skill: ${skill.name}`);
        const embedding = await embeddingClient.generateEmbedding(textToEmbed);

        await db.query(
          'UPDATE skills SET embedding = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [JSON.stringify(embedding), skill.id]
        );

        logger.info(`✓ Skill ${skill.name} embedding saved`);

        // Add delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        logger.error(`Failed to process skill ${skill.name}: ${error}`);
      }
    }

    // -----------------------------------------------------------------------
    // Step 3: Workspaces
    // -----------------------------------------------------------------------
    logger.info('Processing workspaces...');
    const workspacesResult = await db.query(
      "SELECT id, name, description FROM workspaces WHERE embedding IS NULL AND status = 'active'"
    );

    const workspaces = workspacesResult.rows;
    logger.info(`Found ${workspaces.length} workspaces without embeddings`);

    for (let i = 0; i < workspaces.length; i++) {
      const ws = workspaces[i];
      try {
        // Combine name + description for richer semantic context
        const textToEmbed = [ws.name, ws.description].filter(Boolean).join(' — ');

        logger.info(`[${i + 1}/${workspaces.length}] Generating embedding for workspace: ${ws.name}`);
        const embedding = await embeddingClient.generateEmbedding(textToEmbed);

        await db.query(
          'UPDATE workspaces SET embedding = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [JSON.stringify(embedding), ws.id]
        );

        logger.info(`✓ Workspace "${ws.name}" embedding saved`);

        // Add delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        logger.error(`Failed to process workspace "${ws.name}": ${error}`);
      }
    }

    // -----------------------------------------------------------------------
    // Stats summary
    // -----------------------------------------------------------------------
    const [toolStats, skillStats, wsStats] = await Promise.all([
      db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE embedding IS NOT NULL) as with_embedding,
          COUNT(*) as total
        FROM tools
      `),
      db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE embedding IS NOT NULL) as with_embedding,
          COUNT(*) as total
        FROM skills
      `),
      db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE embedding IS NOT NULL) as with_embedding,
          COUNT(*) as total
        FROM workspaces
      `),
    ]);

    logger.info('=== Embedding Generation Complete ===');
    logger.info(
      `Tools:      ${toolStats.rows[0].with_embedding}/${toolStats.rows[0].total} with embeddings`
    );
    logger.info(
      `Skills:     ${skillStats.rows[0].with_embedding}/${skillStats.rows[0].total} with embeddings`
    );
    logger.info(
      `Workspaces: ${wsStats.rows[0].with_embedding}/${wsStats.rows[0].total} with embeddings`
    );
  } catch (error) {
    logger.error(`Batch embedding failed: ${error}`);
    process.exit(1);
  } finally {
    await db.end();
  }
}

main();
