// Migration runner: applies pending migrations/*.sql in version order and
// records each one in schema_migrations.
//
//   npm run db:migrate              apply pending migrations
//   npm run db:migrate -- --status  list applied and pending migrations
//   npm run db:migrate -- --baseline
//       record every pending file as applied without running it (one-time, for
//       databases that were migrated before schema_migrations existed)
//
// Uses POSTGRES_URL_NON_POOLING if set, otherwise POSTGRES_URL.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import {
  appliedMigrations,
  ensureMigrationsTable,
  loadMigrations,
  planMigrations,
  runMigrations,
} from '@/lib/migrations';
import { createPostgresPoolConfig } from '@/lib/postgres-config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
// Load env from .env.local if present; fallback to .env
dotenv.config({ path: path.join(root, '.env.local') });
dotenv.config();

const args = new Set(process.argv.slice(2));
const migrationsDir = path.join(root, 'migrations');

async function main() {
  if (!process.env.POSTGRES_URL_NON_POOLING && !process.env.POSTGRES_URL) {
    throw new Error('Set POSTGRES_URL (or POSTGRES_URL_NON_POOLING)');
  }
  const pool = new Pool(createPostgresPoolConfig(process.env, { statementTimeoutMs: 0 }));
  const client = await pool.connect();
  try {
    if (args.has('--status')) {
      await ensureMigrationsTable(client);
      const plan = planMigrations(await loadMigrations(migrationsDir), await appliedMigrations(client));
      for (const file of plan.applied) console.log(`applied  ${file.file}`);
      for (const { file } of plan.drifted) console.log(`DRIFTED  ${file.file} (file changed since it was applied)`);
      for (const record of plan.orphaned) console.log(`orphaned ${record.version}_${record.name} (no file)`);
      for (const file of plan.pending) console.log(`pending  ${file.file}`);
      if (plan.pending.length === 0 && plan.drifted.length === 0) console.log('Database is up to date.');
      return;
    }

    const result = await runMigrations(client, {
      dir: migrationsDir,
      baseline: args.has('--baseline'),
      log: (message) => console.log(message),
    });
    if (result.baselined.length > 0) {
      console.log(`Baselined ${result.baselined.length} migration(s): ${result.baselined.join(', ')}`);
    }
    if (result.applied.length > 0) {
      console.log(`Applied ${result.applied.length} migration(s): ${result.applied.join(', ')}`);
    }
    if (result.applied.length === 0 && result.baselined.length === 0) {
      console.log(`Nothing to apply (${result.skipped} already recorded).`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('Migration failed:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
