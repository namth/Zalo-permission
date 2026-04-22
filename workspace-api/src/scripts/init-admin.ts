import { UserService } from '@/services/user.service';
import { hashPassword } from '@/lib/auth';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: '.env.local' });

async function initAdmin() {
  const adminUsername = 'admin';
  const adminPassword = 'admin_password_2024'; // USER SHOULD CHANGE THIS LATER
  const adminZaloId = 'ADMIN_INTERNAL';

  console.log('Initializing admin user...');

  try {
    const existing = await UserService.getUserByUsername(adminUsername);
    if (existing) {
      console.log('Admin user already exists.');
      return;
    }

    await UserService.createUser({
      zalo_id: adminZaloId,
      username: adminUsername,
      password: adminPassword,
      full_name: 'System Administrator',
      role: 'admin'
    });

    console.log('✅ Admin user created successfully!');
    console.log(`Username: ${adminUsername}`);
    console.log(`Password: ${adminPassword}`);
    console.log('Please change this password after logging in.');
  } catch (error) {
    console.error('Failed to initialize admin:', error);
  } finally {
    process.exit(0);
  }
}

initAdmin();
