// One-time migration runner for local/CI.
// Uses POSTGRES_URL_NON_POOLING if set, otherwise POSTGRES_URL.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { createPostgresPoolConfig } from '@/lib/postgres-config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
// Load env from .env.local if present; fallback to .env
dotenv.config({ path: path.join(root, '.env.local') });
dotenv.config();
async function main() {
  if (!process.env.POSTGRES_URL_NON_POOLING && !process.env.POSTGRES_URL) {
    throw new Error('Set POSTGRES_URL (or POSTGRES_URL_NON_POOLING)');
  }
  const pool = new Pool(createPostgresPoolConfig());
  const migDir = path.join(root, 'migrations');
  const files = (await fs.readdir(migDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const f of files) {
      const sql = await fs.readFile(path.join(migDir, f), 'utf-8');
      await client.query(sql);
    }
    await client.query('COMMIT');
    console.log('Migrations applied successfully.');
  } catch (e: unknown) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', e instanceof Error ? e.message : String(e));
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
