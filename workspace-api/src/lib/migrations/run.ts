import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, '05_tool_groups.sql'), 'utf-8');
  console.log('Running migration...');
  await pool.query(sql);
  console.log('Migration completed.');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
