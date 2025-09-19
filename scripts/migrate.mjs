// One-time migration runner for local/CI.
// Uses POSTGRES_URL_NON_POOLING if set, otherwise POSTGRES_URL.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
// Load env from .env.local if present; fallback to .env
dotenv.config({ path: path.join(root, '.env.local') });
dotenv.config();
async function main() {
  let conn = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!conn) {
    throw new Error('Set POSTGRES_URL (or POSTGRES_URL_NON_POOLING)');
  }
  if (/sslmode=/i.test(conn)) {
    conn = conn.replace(/sslmode=[^&]+/i, 'sslmode=no-verify');
  } else {
    conn += (conn.includes('?') ? '&' : '?') + 'sslmode=no-verify';
  }
  const pool = new Pool({ connectionString: conn, ssl: { rejectUnauthorized: false } });
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
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', e.message);
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
