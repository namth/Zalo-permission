import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import neo4j from 'neo4j-driver';

// Load env from multiple possible locations
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/web/.env') });

const { Pool } = pg;

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ Error: DATABASE_URL is not set in environment or .env file');
    process.exit(1);
  }

  const username = process.argv[2] || process.env.ADMIN_USERNAME || 'admin';
  const password = process.argv[3] || process.env.ADMIN_PASSWORD || 'admin_password_2024';

  console.log(`🔒 Initializing admin user: "${username}"...`);

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // 1. Ensure table exists with correct schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_profile (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        zalo_id VARCHAR(255) UNIQUE,
        username VARCHAR(255) UNIQUE,
        password_hash TEXT,
        full_name VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(20),
        gender VARCHAR(20),
        note TEXT,
        role VARCHAR(50) DEFAULT 'user',
        status VARCHAR(50) DEFAULT 'active',
        api_token VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Check if user already exists
    const check = await pool.query('SELECT id, username, role FROM user_profile WHERE username = $1', [username]);
    if (check.rows.length > 0) {
      console.log(`ℹ️ User "${username}" already exists with role: "${check.rows[0].role}".`);
      if (check.rows[0].role !== 'admin') {
        await pool.query('UPDATE user_profile SET role = $1 WHERE username = $2', ['admin', username]);
        console.log(`✅ Elevated "${username}" role to "admin".`);
      }
      return;
    }

    // 3. Hash password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const id = crypto.randomUUID();
    const apiToken = `zp_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

    // 4. Insert into PostgreSQL
    await pool.query(
      `INSERT INTO user_profile (id, zalo_id, username, password_hash, full_name, role, status, api_token, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, NOW(), NOW())`,
      [id, 'ADMIN_INTERNAL', username, hash, 'System Administrator', 'admin', apiToken]
    );

    console.log('✅ Admin user created successfully!');
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);
    console.log('   (You can log in at https://zalo.oa.io.vn/login)');

    // 5. Sync to Neo4j if configured
    if (process.env.NEO4J_URI && process.env.NEO4J_PASSWORD) {
      try {
        const driver = neo4j.driver(
          process.env.NEO4J_URI,
          neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD)
        );
        const session = driver.session();
        await session.run(
          `MERGE (u:ZaloUser {id: $id})
           ON CREATE SET u.name = 'System Administrator', u.zalo_id = 'ADMIN_INTERNAL'
           RETURN u`,
          { id }
        );
        await session.close();
        await driver.close();
        console.log('✅ Synced admin node to Neo4j.');
      } catch (neoErr) {
        console.warn('⚠️ Neo4j sync note:', neoErr.message);
      }
    }
  } catch (err) {
    console.error('❌ Failed to initialize admin:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
