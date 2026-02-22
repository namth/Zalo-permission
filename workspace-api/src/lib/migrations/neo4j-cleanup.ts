
import { executeQuery } from '../db';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

async function cleanupNeo4j() {
    console.log('Starting Neo4j cleanup...');

    try {
        // Remove properties from all nodes
        const query = `
      MATCH (n)
      REMOVE n.status, n.created_at
      RETURN count(n) as processed
    `;

        console.log('Executing query:', query);
        const result = await executeQuery(query);

        const count = result.records[0].get('processed').low;
        console.log(`✅ Cleanup complete. Processed ${count} nodes.`);

    } catch (error) {
        console.error('❌ Cleanup failed:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

cleanupNeo4j();
