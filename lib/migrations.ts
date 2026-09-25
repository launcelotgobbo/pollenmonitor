import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ClientBase } from 'pg';

export type MigrationFile = {
  version: string;
  name: string;
  file: string;
  sql: string;
  checksum: string;
};

export type MigrationRecord = {
  version: string;
  name: string;
  checksum: string;
  applied_at: string;
};

export type MigrationPlan = {
  pending: MigrationFile[];
  applied: MigrationFile[];
  // Applied migrations whose file content no longer matches what was run.
  drifted: Array<{ file: MigrationFile; record: MigrationRecord }>;
  // Recorded versions with no file on disk (deleted or renamed after applying).
  orphaned: MigrationRecord[];
};

export type MigrationRunResult = {
  applied: string[];
  baselined: string[];
  skipped: number;
};

const MIGRATION_FILE = /^(\d{3,})_([A-Za-z0-9][\w-]*)\.sql$/;

// Serialises concurrent runners (two deploys, or a human and CI) on one lock.
const MIGRATION_LOCK_KEY = 7_218_311_042;

// Supabase's default privileges hand anon/authenticated full access to every
// new table in public over PostgREST. A client deleting a row here would make
// the runner re-apply that migration, so the table is closed to those roles
// the same way 007 closed the app tables. RLS is enabled but not forced: the
// owner keeps reading it even without BYPASSRLS.
export const SCHEMA_MIGRATIONS_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    name text NOT NULL,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  );
  ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
  DO $$
  DECLARE
    blocked_role text;
  BEGIN
    FOR blocked_role IN
      SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
    LOOP
      EXECUTE format('REVOKE ALL PRIVILEGES ON schema_migrations FROM %I', blocked_role);
    END LOOP;
  END
  $$;
`;

export function checksumSql(sql: string): string {
  return createHash('sha256').update(sql).digest('hex');
}

export async function loadMigrations(dir: string): Promise<MigrationFile[]> {
  const entries = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const files: MigrationFile[] = [];
  const seen = new Map<string, string>();
  for (const file of entries) {
    const match = MIGRATION_FILE.exec(file);
    if (!match) {
      throw new Error(`Migration file name must look like 001_name.sql: ${file}`);
    }
    const [, version, name] = match;
    const clash = seen.get(version);
    if (clash) {
      throw new Error(`Duplicate migration version ${version}: ${clash} and ${file}`);
    }
    seen.set(version, file);
    const sql = await fs.readFile(path.join(dir, file), 'utf-8');
    files.push({ version, name, file, sql, checksum: checksumSql(sql) });
  }
  return files;
}

export async function ensureMigrationsTable(client: ClientBase) {
  await client.query(SCHEMA_MIGRATIONS_SQL);
}

export async function appliedMigrations(client: ClientBase): Promise<MigrationRecord[]> {
  const { rows } = await client.query<MigrationRecord>(
    `SELECT version, name, checksum,
            to_char(applied_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS applied_at
     FROM schema_migrations
     ORDER BY version`,
  );
  return rows;
}

export function planMigrations(files: MigrationFile[], records: MigrationRecord[]): MigrationPlan {
  const byVersion = new Map(records.map((r) => [r.version, r]));
  const plan: MigrationPlan = { pending: [], applied: [], drifted: [], orphaned: [] };
  const known = new Set<string>();
  for (const file of files) {
    known.add(file.version);
    const record = byVersion.get(file.version);
    if (!record) {
      plan.pending.push(file);
    } else if (record.checksum !== file.checksum) {
      plan.drifted.push({ file, record });
    } else {
      plan.applied.push(file);
    }
  }
  plan.orphaned = records.filter((r) => !known.has(r.version));
  return plan;
}

async function recordMigration(client: ClientBase, file: MigrationFile) {
  await client.query(
    `INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)`,
    [file.version, file.name, file.checksum],
  );
}

export type RunMigrationsOptions = {
  dir: string;
  // Record every pending file as applied without executing it. For databases
  // that were migrated before schema_migrations existed.
  baseline?: boolean;
  log?: (message: string) => void;
};

/**
 * Apply pending migrations in version order, each in its own transaction, and
 * record them in schema_migrations. Refuses to run when an applied migration's
 * file has changed, since the database and the repository would disagree
 * about what that version means.
 */
export async function runMigrations(
  client: ClientBase,
  { dir, baseline = false, log = () => {} }: RunMigrationsOptions,
): Promise<MigrationRunResult> {
  await ensureMigrationsTable(client);
  await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
  try {
    const files = await loadMigrations(dir);
    const plan = planMigrations(files, await appliedMigrations(client));

    if (plan.drifted.length > 0) {
      const list = plan.drifted.map(({ file }) => file.file).join(', ');
      throw new Error(
        `Applied migration files have changed since they ran: ${list}. ` +
          'Add a new migration instead of editing an applied one.',
      );
    }
    for (const record of plan.orphaned) {
      log(`warning: schema_migrations has ${record.version}_${record.name} but no such file exists`);
    }

    const result: MigrationRunResult = { applied: [], baselined: [], skipped: plan.applied.length };

    if (baseline) {
      await client.query('BEGIN');
      try {
        for (const file of plan.pending) {
          await recordMigration(client, file);
          result.baselined.push(file.file);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      return result;
    }

    for (const file of plan.pending) {
      log(`applying ${file.file}`);
      await client.query('BEGIN');
      try {
        await client.query(file.sql);
        await recordMigration(client, file);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Migration ${file.file} failed: ${message}`, { cause: error });
      }
      result.applied.push(file.file);
    }
    return result;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
  }
}
