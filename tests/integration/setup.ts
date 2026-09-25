// Shared harness for tests that need a real Postgres. Import this module
// before anything that imports `@/lib/db`, because the pool reads POSTGRES_URL
// when that module is first evaluated.
//
// Every *.dbtest.ts file drops and rebuilds the public schema of the same
// database, so `npm run test:db` runs the files with --test-concurrency=1.
import path from 'node:path';
import { Client } from 'pg';
import { runMigrations } from '@/lib/migrations';
import { createPostgresPoolConfig } from '@/lib/postgres-config';

export const TEST_DATABASE_URL = process.env.POSTGRES_TEST_URL || '';

function assertLocal(url: string) {
  const host = new URL(url).hostname;
  const local = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === 'postgres';
  if (!local && process.env.POSTGRES_TEST_ALLOW_REMOTE !== 'true') {
    throw new Error(
      `POSTGRES_TEST_URL points at ${host}; integration tests truncate tables, so only local hosts are allowed ` +
        '(set POSTGRES_TEST_ALLOW_REMOTE=true to override).',
    );
  }
}

if (TEST_DATABASE_URL) {
  assertLocal(TEST_DATABASE_URL);
  process.env.POSTGRES_URL = TEST_DATABASE_URL;
  delete process.env.POSTGRES_URL_NON_POOLING;
}

// Tests run from the repository root via npm scripts.
export const MIGRATIONS_DIR = path.resolve(process.cwd(), 'migrations');

export const APP_TABLES = [
  'pollen_readings_hourly',
  'pollen_forecast_hourly',
  'weather_daily',
  'ingest_logs',
  'ambee_usage_logs',
] as const;

export function connectTestClient(): Promise<Client> {
  const client = new Client(
    createPostgresPoolConfig({ POSTGRES_URL: TEST_DATABASE_URL }, { statementTimeoutMs: 0 }),
  );
  return client.connect().then(() => client);
}

// The RLS migrations reference Supabase's client roles; plain Postgres needs
// them to exist for CREATE POLICY ... TO <role> to parse. Supabase also grants
// those roles everything on new tables in public, which is what the RLS
// migrations guard against, so the harness reproduces that. Default
// privileges belong to the schema, so call this after resetSchema.
export async function ensureSupabaseRoles(client: Client) {
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await client.query(
      `DO $$ BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
           EXECUTE 'CREATE ROLE ${role} NOLOGIN';
         END IF;
       END $$`,
    );
  }
  await client.query(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role',
  );
}

export async function resetSchema(client: Client) {
  await client.query('DROP SCHEMA public CASCADE');
  await client.query('CREATE SCHEMA public');
}

/** Drop everything, replay every migration, and leave the tables empty. */
export async function prepareDatabase() {
  const client = await connectTestClient();
  try {
    await resetSchema(client);
    await ensureSupabaseRoles(client);
    await runMigrations(client, { dir: MIGRATIONS_DIR });
  } finally {
    await client.end();
  }
}

export async function truncateAppTables(client: Client) {
  await client.query(`TRUNCATE ${APP_TABLES.join(', ')} RESTART IDENTITY`);
}
