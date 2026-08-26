import { strict as assert } from 'node:assert';
import test from 'node:test';
import { createPostgresPoolConfig } from '@/lib/postgres-config';
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
