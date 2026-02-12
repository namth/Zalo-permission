import { getDb } from '../db';
import fs from 'fs';
import path from 'path';

/**
 * Run all SQL migrations
 */
export async function runMigrations(): Promise<void> {
  const dbPool = getDb();
  const migrationsDir = path.join(__dirname);

  // Read all .sql files and sort them
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files`);

  for (const file of files) {
    try {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`Running migration: ${file}`);
      await dbPool.query(sql);
      console.log(`✅ Migration completed: ${file}`);
    } catch (error) {
      console.error(`❌ Migration failed: ${file}`, error);
      throw error;
    }
  }

  console.log('✅ All migrations completed');
}

// Run if called directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migrations completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration error:', error);
      process.exit(1);
    });
}
