
import { neo4jClient } from '../neo4j';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

async function migrateUserToZaloUser() {
    console.log('Starting migration: User -> ZaloUser in Neo4j...');
    // accessing private driver via any cast for migration script
    const driver = (neo4jClient as any).driver;
    const session = driver.session();

    try {
        // 1. Rename labels from User to ZaloUser
        const result = await session.run(
            `MATCH (n:User)
       REMOVE n:User
       SET n:ZaloUser
       RETURN count(n) as count`
        );

        const count = result.records[0].get('count').toNumber();
        console.log(`Migrated ${count} nodes from :User to :ZaloUser.`);

        // 2. Verify no Users left
        const verify = await session.run(
            `MATCH (n:User) RETURN count(n) as count`
        );
        const verifiedCount = verify.records[0].get('count').toNumber();

        if (verifiedCount === 0) {
            console.log('Verification SUCCESS: No :User nodes remaining.');
        } else {
            console.warn(`Verification WARNING: ${verifiedCount} :User nodes still exist.`);
        }

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await session.close();
        // Do not close the driver if it's shared, or do it if this script implementation is standalone
        // Since we are using the singleton, better to just exit process
        process.exit(0);
    }
}

migrateUserToZaloUser();
