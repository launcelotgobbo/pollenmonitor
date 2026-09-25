import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  CONNECTION_TIMEOUT_MS,
  DEFAULT_POOL_MAX,
  DEFAULT_STATEMENT_TIMEOUT_MS,
  IDLE_TIMEOUT_MS,
  createPostgresPoolConfig,
} from '@/lib/postgres-config';
import { SUPABASE_ROOT_2021_CA } from '@/lib/supabase-ca';

test('Postgres config verifies Supabase TLS with the pinned root', () => {
  const config = createPostgresPoolConfig({
    POSTGRES_URL: 'postgres://aws.pooler.supabase.com:5432/db?sslmode=no-verify',
  });

  assert.equal(config.connectionString, 'postgres://aws.pooler.supabase.com:5432/db');
  assert.deepEqual(config.ssl, { ca: SUPABASE_ROOT_2021_CA, rejectUnauthorized: true });
});

test('Postgres config verifies public roots by default', () => {
  const config = createPostgresPoolConfig({
    POSTGRES_URL: 'postgres://database.example.com:5432/db?sslmode=require',
  });

  assert.equal(config.connectionString, 'postgres://database.example.com:5432/db');
  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
});

test('Postgres config bounds the pool and statement time by default', () => {
  const config = createPostgresPoolConfig({ POSTGRES_URL: 'postgres://database.example.com/db' });

  assert.equal(config.max, DEFAULT_POOL_MAX);
  assert.equal(config.connectionTimeoutMillis, CONNECTION_TIMEOUT_MS);
  assert.equal(config.idleTimeoutMillis, IDLE_TIMEOUT_MS);
  assert.equal(config.statement_timeout, DEFAULT_STATEMENT_TIMEOUT_MS);
});

test('Postgres config accepts env overrides and lets migrations disable the statement timeout', () => {
  const overridden = createPostgresPoolConfig({
    POSTGRES_URL: 'postgres://database.example.com/db',
    POSTGRES_POOL_MAX: '2',
    POSTGRES_STATEMENT_TIMEOUT_MS: '5000',
  });
  assert.equal(overridden.max, 2);
  assert.equal(overridden.statement_timeout, 5000);

  const invalid = createPostgresPoolConfig({
    POSTGRES_URL: 'postgres://database.example.com/db',
    POSTGRES_POOL_MAX: 'lots',
    POSTGRES_STATEMENT_TIMEOUT_MS: '-1',
  });
  assert.equal(invalid.max, DEFAULT_POOL_MAX);
  assert.equal(invalid.statement_timeout, DEFAULT_STATEMENT_TIMEOUT_MS);

  const migration = createPostgresPoolConfig(
    { POSTGRES_URL: 'postgres://database.example.com/db' },
    { statementTimeoutMs: 0 },
  );
  assert.equal('statement_timeout' in migration, false);
});

test('Postgres config turns TLS off only for an explicit sslmode=disable', () => {
  const plain = createPostgresPoolConfig({
    POSTGRES_URL: 'postgres://postgres:postgres@localhost:5432/db?sslmode=disable',
  });
  assert.equal(plain.ssl, false);
  assert.equal(plain.connectionString, 'postgres://postgres:postgres@localhost:5432/db');

  const lookalike = createPostgresPoolConfig({
    POSTGRES_URL: 'postgres://localhost:5432/db?sslmode=disabled-not-really',
  });
  assert.deepEqual(lookalike.ssl, { rejectUnauthorized: true });
});

test('Postgres config supports an explicit CA and opt-out', () => {
  assert.deepEqual(
    createPostgresPoolConfig({
      POSTGRES_URL: 'postgres://database.example.com/db',
      POSTGRES_CA_CERT: 'line1\\nline2',
    }).ssl,
    { ca: 'line1\nline2', rejectUnauthorized: true },
  );

  assert.deepEqual(
    createPostgresPoolConfig({
      POSTGRES_URL: 'postgres://database.example.com/db',
      POSTGRES_SSL_NO_VERIFY: 'true',
    }).ssl,
    { rejectUnauthorized: false },
  );
});
