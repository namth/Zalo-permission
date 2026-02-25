/**
 * Script: backfill-workspace-embeddings.ts
 * Generates and stores embeddings for all workspaces that don't have one yet.
 *
 * Run: npx ts-node -r tsconfig-paths/register scripts/backfill-workspace-embeddings.ts
 */

import { Pool } from 'pg';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: text,
        dimensions: 1536,
    });
    return response.data[0].embedding;
}

async function main() {
    console.log('🔍 Finding workspaces without embeddings...');

    const { rows } = await db.query(
        `SELECT id, name, description FROM workspaces WHERE embedding IS NULL ORDER BY created_at ASC`
    );

    if (rows.length === 0) {
        console.log('✅ All workspaces already have embeddings.');
        await db.end();
        return;
    }

    console.log(`📦 Found ${rows.length} workspaces to embed.\n`);

    let success = 0;
    let failed = 0;

    for (const ws of rows) {
        // Combine name + description for richer semantic context
        const text = [ws.name, ws.description].filter(Boolean).join(' — ');
        try {
            const embedding = await generateEmbedding(text);
            await db.query(
                `UPDATE workspaces SET embedding = $1::vector WHERE id = $2`,
                [JSON.stringify(embedding), ws.id]
            );
            console.log(`  ✅ [${ws.id}] "${ws.name}"`);
            success++;
        } catch (err) {
            console.error(`  ❌ [${ws.id}] "${ws.name}": ${err}`);
            failed++;
        }

        // Rate-limit: ~10 req/s
        await new Promise(r => setTimeout(r, 100));
    }

    console.log(`\n🎉 Done: ${success} succeeded, ${failed} failed.`);
    await db.end();
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
