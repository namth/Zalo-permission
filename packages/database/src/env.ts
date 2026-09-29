import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

let envLoaded = false;

export function ensureEnvLoaded(): void {
  if (envLoaded && process.env.DATABASE_URL) {
    return;
  }

  const candidateDirs = [
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    path.resolve(process.cwd(), '../..'),
    path.resolve(process.cwd(), '../../..'),
  ];

  for (const dir of candidateDirs) {
    const envFile = path.join(dir, '.env');
    if (fs.existsSync(envFile)) {
      dotenv.config({ path: envFile });
      if (process.env.DATABASE_URL) {
        envLoaded = true;
        break;
      }
    }
  }

  envLoaded = true;
}
