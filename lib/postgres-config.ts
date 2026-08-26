import type { PoolConfig } from 'pg';
import { SUPABASE_ROOT_2021_CA } from '@/lib/supabase-ca';

type PostgresEnvironment = {
  [key: string]: string | undefined;
  POSTGRES_URL?: string;
  POSTGRES_URL_NON_POOLING?: string;
  POSTGRES_CA_CERT?: string;
  POSTGRES_SSL_NO_VERIFY?: string;
};

function withoutSslMode(connectionString: string) {
  return connectionString
    .replace(/([?&])sslmode=[^&]*&?/i, '$1')
    .replace(/[?&]$/, '');
}

export function createPostgresPoolConfig(
  env: PostgresEnvironment = process.env,
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

  return {
    connectionString,
    ssl: skipVerify
      ? { rejectUnauthorized: false }
      : ca
        ? { ca, rejectUnauthorized: true }
        : { rejectUnauthorized: true },
  };
}
