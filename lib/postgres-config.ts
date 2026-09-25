import type { PoolConfig } from 'pg';
import { SUPABASE_ROOT_2021_CA } from '@/lib/supabase-ca';

type PostgresEnvironment = {
  [key: string]: string | undefined;
  POSTGRES_URL?: string;
  POSTGRES_URL_NON_POOLING?: string;
  POSTGRES_CA_CERT?: string;
  POSTGRES_SSL_NO_VERIFY?: string;
  POSTGRES_POOL_MAX?: string;
  POSTGRES_STATEMENT_TIMEOUT_MS?: string;
};

export type PostgresPoolOptions = {
  // Pass 0 to disable the server-side statement timeout (long-running migrations).
  statementTimeoutMs?: number;
};

// Each serverless instance gets its own pool, so keep it small; the direct
// (non-pooling) Supabase connection has a low global connection cap.
export const DEFAULT_POOL_MAX = 5;
export const DEFAULT_STATEMENT_TIMEOUT_MS = 30_000;
export const CONNECTION_TIMEOUT_MS = 10_000;
export const IDLE_TIMEOUT_MS = 30_000;

function withoutSslMode(connectionString: string) {
  return connectionString
    .replace(/([?&])sslmode=[^&]*&?/i, '$1')
    .replace(/[?&]$/, '');
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function createPostgresPoolConfig(
  env: PostgresEnvironment = process.env,
  { statementTimeoutMs }: PostgresPoolOptions = {},
): PoolConfig {
  const rawConnectionString = env.POSTGRES_URL_NON_POOLING || env.POSTGRES_URL || '';
  const connectionString = withoutSslMode(rawConnectionString);
  const skipVerify = env.POSTGRES_SSL_NO_VERIFY === 'true';
  const isSupabase = /supabase\.(co|com)/.test(connectionString);
  const explicitCa = (env.POSTGRES_CA_CERT || '').replace(/\\n/g, '\n');
  const ca = explicitCa || (isSupabase ? SUPABASE_ROOT_2021_CA : undefined);

  if (skipVerify) {
    console.warn('[db] TLS certificate verification disabled via POSTGRES_SSL_NO_VERIFY', {
      level: 'warn',
      job: 'db',
    });
  }

  const statementTimeout =
    statementTimeoutMs ??
    positiveInteger(env.POSTGRES_STATEMENT_TIMEOUT_MS, DEFAULT_STATEMENT_TIMEOUT_MS);

  return {
    connectionString,
    ssl: skipVerify
      ? { rejectUnauthorized: false }
      : ca
        ? { ca, rejectUnauthorized: true }
        : { rejectUnauthorized: true },
    max: positiveInteger(env.POSTGRES_POOL_MAX, DEFAULT_POOL_MAX),
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    ...(statementTimeout > 0 ? { statement_timeout: statementTimeout } : {}),
  };
}
