import { Pool, defaults, type QueryResult, type QueryResultRow } from 'pg';

// Supabase pooled connections often present self-signed chains; relax verification at driver level
try {
  const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || '';
  if (/supabase\.(co|com)/.test(url)) {
    defaults.ssl = { rejectUnauthorized: false } as any;
  }
} catch {}

let connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || '';
try {
  if (connectionString) {
    if (/sslmode=/.test(connectionString)) {
      connectionString = connectionString.replace(/sslmode=[^&]+/i, 'sslmode=no-verify');
    } else {
      connectionString += (connectionString.includes('?') ? '&' : '?') + 'sslmode=no-verify';
    }
  }
} catch {}

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function q<T extends QueryResultRow = QueryResultRow>(text: string, params?: any[]): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function ensureSchema() {
  await q(`
    CREATE TABLE IF NOT EXISTS pollen_readings_hourly (
      city_slug text NOT NULL,
      ts timestamptz NOT NULL,
      tz text,
      grass integer,
      tree integer,
      weed integer,
      total integer,
      risk_grass text,
      risk_tree text,
      risk_weed text,
      species jsonb,
      source text NOT NULL DEFAULT 'ambee',
      created_at timestamptz DEFAULT now(),
      PRIMARY KEY (city_slug, ts, source)
    );
  `);
  await q(`
    CREATE TABLE IF NOT EXISTS ingest_logs (
      id bigserial PRIMARY KEY,
      ts timestamptz DEFAULT now(),
      job text,
      status text,
      details jsonb
    );
  `);
  await q('CREATE INDEX IF NOT EXISTS idx_hourly_city_ts ON pollen_readings_hourly(city_slug, ts)');
  await q('CREATE INDEX IF NOT EXISTS idx_hourly_ts ON pollen_readings_hourly(ts)');
}

export async function upsertPollenHourly(row: {
  city_slug: string;
  ts: string;
  tz?: string | null;
  grass?: number | null;
  tree?: number | null;
  weed?: number | null;
  total?: number | null;
  risk_grass?: string | null;
  risk_tree?: string | null;
  risk_weed?: string | null;
  species?: any;
}) {
  const total = row.total ?? ((row.grass ?? 0) + (row.tree ?? 0) + (row.weed ?? 0));
  await q(
    `INSERT INTO pollen_readings_hourly (
        city_slug, ts, tz, grass, tree, weed, total, risk_grass, risk_tree, risk_weed, species, source
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'ambee')
     ON CONFLICT (city_slug, ts, source)
     DO UPDATE SET tz = COALESCE(EXCLUDED.tz, pollen_readings_hourly.tz),
                   grass = EXCLUDED.grass,
                   tree = EXCLUDED.tree,
                   weed = EXCLUDED.weed,
                   total = EXCLUDED.total,
                   risk_grass = EXCLUDED.risk_grass,
                   risk_tree = EXCLUDED.risk_tree,
                   risk_weed = EXCLUDED.risk_weed,
                   species = EXCLUDED.species`,
    [
      row.city_slug,
      row.ts,
      row.tz ?? null,
      row.grass ?? null,
      row.tree ?? null,
      row.weed ?? null,
      total,
      row.risk_grass ?? null,
      row.risk_tree ?? null,
      row.risk_weed ?? null,
      row.species ?? null,
    ],
  );
}

export async function logIngest(status: string, details: Record<string, any>) {
  try {
    const json = JSON.stringify(details);
    await q(`INSERT INTO ingest_logs (job, status, details) VALUES ('ingest', $1, $2::jsonb)`, [
      status,
      json,
    ]);
  } catch {}
}
