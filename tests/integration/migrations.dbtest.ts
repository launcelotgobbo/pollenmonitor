import { strict as assert } from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  MIGRATIONS_DIR,
  TEST_DATABASE_URL,
  connectTestClient,
  ensureSupabaseRoles,
  resetSchema,
} from './setup';
import { appliedMigrations, loadMigrations, runMigrations } from '@/lib/migrations';

const skip = TEST_DATABASE_URL ? false : 'POSTGRES_TEST_URL not set';

async function tempMigrationsDir(files: Record<string, string>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pm-migrations-'));
  for (const [name, sql] of Object.entries(files)) {
    await fs.writeFile(path.join(dir, name), sql);
  }
  return dir;
}

test('repository migrations apply cleanly, are recorded, and are idempotent', { skip }, async () => {
  const client = await connectTestClient();
  try {
    await resetSchema(client);
    await ensureSupabaseRoles(client);

    const files = await loadMigrations(MIGRATIONS_DIR);
    const first = await runMigrations(client, { dir: MIGRATIONS_DIR });
    assert.deepEqual(first.applied, files.map((f) => f.file));
    assert.equal(first.skipped, 0);

    const records = await appliedMigrations(client);
    assert.deepEqual(
      records.map((r) => [r.version, r.checksum]),
      files.map((f) => [f.version, f.checksum]),
    );

    const second = await runMigrations(client, { dir: MIGRATIONS_DIR });
    assert.deepEqual(second.applied, []);
    assert.equal(second.skipped, files.length);

    const { rows: tables } = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1`,
    );
    assert.deepEqual(
      tables.map((t) => t.table_name),
      [
        'ambee_usage_logs',
        'ingest_logs',
        'pollen_forecast_hourly',
        'pollen_readings_hourly',
        'schema_migrations',
        'weather_daily',
      ],
    );
    const { rows: policies } = await client.query(`SELECT 1 FROM pg_policies WHERE schemaname = 'public'`);
    assert.equal(policies.length, 0, '007 removes the PostgREST policies');

    // The harness grants anon everything on new tables, as Supabase does;
    // 007 and the runner must both take that back.
    const { rows: exposure } = await client.query<{ table: string; rls: boolean; anon_any: boolean }>(
      `SELECT relname AS "table",
              relrowsecurity AS rls,
              has_any_column_privilege('anon', oid, 'SELECT')
                OR has_table_privilege('anon', oid, 'INSERT, UPDATE, DELETE, TRUNCATE') AS anon_any
       FROM pg_class
       WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
       ORDER BY relname`,
    );
    assert.equal(exposure.length, tables.length);
    for (const row of exposure) {
      assert.equal(row.rls, true, `${row.table} has RLS enabled`);
      assert.equal(row.anon_any, false, `anon has no privileges on ${row.table}`);
    }
  } finally {
    await client.end();
  }
});

test('baseline records existing migrations without executing them', { skip }, async () => {
  const client = await connectTestClient();
  try {
    await resetSchema(client);
    const dir = await tempMigrationsDir({
      '001_boom.sql': 'SELECT 1/0',
      '002_table.sql': 'CREATE TABLE baseline_check (id int)',
    });

    const result = await runMigrations(client, { dir, baseline: true });
    assert.deepEqual(result.baselined, ['001_boom.sql', '002_table.sql']);
    assert.deepEqual(result.applied, []);

    const { rows } = await client.query(`SELECT to_regclass('public.baseline_check') AS reg`);
    assert.equal(rows[0].reg, null, 'baseline must not run the SQL');

    const again = await runMigrations(client, { dir });
    assert.deepEqual(again.applied, []);
    assert.equal(again.skipped, 2);
  } finally {
    await client.end();
  }
});

test('a failing migration is rolled back and later ones are not attempted', { skip }, async () => {
  const client = await connectTestClient();
  try {
    await resetSchema(client);
    const dir = await tempMigrationsDir({
      '001_ok.sql': 'CREATE TABLE step_one (id int)',
      '002_bad.sql': 'CREATE TABLE step_two (id int); SELECT 1/0;',
      '003_never.sql': 'CREATE TABLE step_three (id int)',
    });

    await assert.rejects(runMigrations(client, { dir }), /Migration 002_bad\.sql failed: division by zero/);

    const { rows } = await client.query(
      `SELECT to_regclass('public.step_one') AS one,
              to_regclass('public.step_two') AS two,
              to_regclass('public.step_three') AS three`,
    );
    assert.equal(rows[0].one, 'step_one');
    assert.equal(rows[0].two, null);
    assert.equal(rows[0].three, null);
    assert.deepEqual((await appliedMigrations(client)).map((r) => r.version), ['001']);

    // Fixing the file lets the run resume from the failed version.
    await fs.writeFile(path.join(dir, '002_bad.sql'), 'CREATE TABLE step_two (id int)');
    const resumed = await runMigrations(client, { dir });
    assert.deepEqual(resumed.applied, ['002_bad.sql', '003_never.sql']);
  } finally {
    await client.end();
  }
});

test('editing an applied migration is refused', { skip }, async () => {
  const client = await connectTestClient();
  try {
    await resetSchema(client);
    const dir = await tempMigrationsDir({ '001_ok.sql': 'CREATE TABLE drift_check (id int)' });
    await runMigrations(client, { dir });

    await fs.writeFile(path.join(dir, '001_ok.sql'), 'CREATE TABLE drift_check (id int, extra text)');
    await assert.rejects(runMigrations(client, { dir }), /changed since they ran: 001_ok\.sql/);
  } finally {
    await client.end();
  }
});

test('loadMigrations rejects malformed names and duplicate versions', async () => {
  await assert.rejects(
    loadMigrations(await tempMigrationsDir({ 'init.sql': 'SELECT 1' })),
    /must look like 001_name\.sql/,
  );
  await assert.rejects(
    loadMigrations(await tempMigrationsDir({ '001_a.sql': 'SELECT 1', '001_b.sql': 'SELECT 2' })),
    /Duplicate migration version 001/,
  );
});
