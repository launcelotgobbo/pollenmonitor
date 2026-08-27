import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import { createPostgresPoolConfig } from '@/lib/postgres-config';

const pool = new Pool(createPostgresPoolConfig());

export type DatabaseFailureKind = 'connection' | 'query';

const CONNECTION_ERROR_CODES = new Set([
  '3D000',
  '28P01',
  '53300',
  '57P01',
  '57P02',
  '57P03',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'ETIMEDOUT',
]);

function errorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

export function classifyDatabaseError(error: unknown): DatabaseFailureKind {
  const code = errorCode(error);
  return code?.startsWith('08') || (code && CONNECTION_ERROR_CODES.has(code))
    ? 'connection'
    : 'query';
}

export class DatabaseOperationError extends Error {
  constructor(
    readonly kind: DatabaseFailureKind,
    readonly code: string | null,
    cause: unknown,
  ) {
    super(`Database ${kind} failed${code ? ` (${code})` : ''}`, { cause });
    this.name = 'DatabaseOperationError';
  }
}

async function q<T extends QueryResultRow = QueryResultRow>(text: string, params?: any[]): Promise<QueryResult<T>> {
  try {
    return await pool.query<T>(text, params);
  } catch (error) {
    throw new DatabaseOperationError(
      classifyDatabaseError(error),
      errorCode(error),
      error,
    );
  }
}

export const query = q;

// Matches PostgREST's timestamptz JSON serialization so API responses keep
// their shape now that reads go through pg directly.
export const TS_ISO = `to_char(ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

export function numericSpeciesEntriesSql(speciesExpression: string) {
  return `jsonb_each(
            CASE WHEN jsonb_typeof(${speciesExpression}) = 'object' THEN ${speciesExpression} ELSE '{}'::jsonb END
          ) AS category
          CROSS JOIN LATERAL (
            SELECT key, value
            FROM jsonb_each_text(
              CASE WHEN jsonb_typeof(category.value) = 'object' THEN category.value ELSE '{}'::jsonb END
            )
            WHERE value ~ '^-?[0-9]+(?:\\.[0-9]+)?$'
          ) AS item`;
}

export type PollenHourlyRow = {
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
  species?: unknown;
};

export async function upsertPollenHourlyBatch(rows: PollenHourlyRow[]) {
  if (rows.length === 0) return;
  // Dedupe on the conflict key; a batch with duplicate (city_slug, ts) rows
  // would make ON CONFLICT DO UPDATE fail with "cannot affect row a second time"
  const byKey = new Map<string, PollenHourlyRow>();
  for (const row of rows) byKey.set(`${row.city_slug}\u0000${row.ts}`, row);
  const unique = [...byKey.values()];

  const params: any[] = [];
  const tuples = unique.map((row, i) => {
    const total = row.total ?? ((row.grass ?? 0) + (row.tree ?? 0) + (row.weed ?? 0));
    params.push(
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
    );
    const base = i * 11;
    return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},'ambee')`;
  });

  await q(
    `INSERT INTO pollen_readings_hourly (
        city_slug, ts, tz, grass, tree, weed, total, risk_grass, risk_tree, risk_weed, species, source
     ) VALUES ${tuples.join(',')}
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
    params,
  );
}

export async function upsertPollenForecastBatch(rows: PollenHourlyRow[]) {
  if (rows.length === 0) return;
  const byKey = new Map<string, PollenHourlyRow>();
  for (const row of rows) byKey.set(`${row.city_slug}\u0000${row.ts}`, row);
  const unique = [...byKey.values()];

  const params: any[] = [];
  const tuples = unique.map((row, i) => {
    const total = row.total ?? ((row.grass ?? 0) + (row.tree ?? 0) + (row.weed ?? 0));
    params.push(
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
    );
    const base = i * 11;
    return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},now())`;
  });

  await q(
    `INSERT INTO pollen_forecast_hourly (
        city_slug, ts, tz, grass, tree, weed, total, risk_grass, risk_tree, risk_weed, species, fetched_at
     ) VALUES ${tuples.join(',')}
     ON CONFLICT (city_slug, ts)
     DO UPDATE SET tz = COALESCE(EXCLUDED.tz, pollen_forecast_hourly.tz),
                   grass = EXCLUDED.grass,
                   tree = EXCLUDED.tree,
                   weed = EXCLUDED.weed,
                   total = EXCLUDED.total,
                   risk_grass = EXCLUDED.risk_grass,
                   risk_tree = EXCLUDED.risk_tree,
                   risk_weed = EXCLUDED.risk_weed,
                   species = EXCLUDED.species,
                   fetched_at = now()`,
    params,
  );
}

export type ForecastRow = {
  ts: string;
  tz: string | null;
  grass: number | null;
  tree: number | null;
  weed: number | null;
  total: number | null;
  risk_grass: string | null;
  risk_tree: string | null;
  risk_weed: string | null;
  species: unknown;
};

export async function getForecastRows(
  citySlug: string,
): Promise<{ rows: ForecastRow[]; fetchedAt: string | null }> {
  const res = await q<ForecastRow & { fetched_at: string }>(
    `SELECT ${TS_ISO} AS ts, tz, grass, tree, weed, total, risk_grass, risk_tree, risk_weed, species,
            to_char(fetched_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS fetched_at
     FROM pollen_forecast_hourly
     WHERE city_slug = $1 AND ts >= now() - interval '1 hour'
     ORDER BY ts ASC`,
    [citySlug],
  );
  let fetchedAt: string | null = null;
  for (const row of res.rows) {
    if (!fetchedAt || row.fetched_at > fetchedAt) fetchedAt = row.fetched_at;
  }
  return { rows: res.rows.map(({ fetched_at, ...rest }) => rest), fetchedAt };
}

export async function reserveAmbeeCall({
  job,
  jobId,
  dailyQuota,
  reserve,
  notes,
}: {
  job: string;
  jobId: string;
  dailyQuota: number;
  reserve: number;
  notes?: Record<string, any>;
}): Promise<{ reserved: boolean; usedBefore: number }> {
  const result = await q<{ reserved: boolean; used_before: string }>(
    `WITH provider_lock AS MATERIALIZED (
       SELECT pg_advisory_xact_lock(hashtext('ambee-daily-quota'))
     ),
     usage AS MATERIALIZED (
       SELECT COALESCE(SUM(ambee_calls), 0)::bigint AS used_before
       FROM ambee_usage_logs, provider_lock
       WHERE job NOT LIKE '%openweather%'
         AND ts >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
     ),
     reservation AS (
       INSERT INTO ambee_usage_logs (job, job_id, ambee_calls, notes)
       SELECT $1, $2, 1, $5::jsonb
       FROM usage
       WHERE used_before < $3::bigint - $4::bigint
       RETURNING true AS reserved
     )
     SELECT EXISTS(SELECT 1 FROM reservation) AS reserved,
            usage.used_before::text
     FROM usage`,
    [job, jobId, dailyQuota, reserve, notes ? JSON.stringify(notes) : null],
  );
  const row = result.rows[0];
  return {
    reserved: Boolean(row?.reserved),
    usedBefore: Number(row?.used_before ?? 0),
  };
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

// Records API call counts for any provider; the table predates the
// OpenWeather integration, hence the ambee_* naming.
export async function logProviderUsage(job: string, jobId: string | null, calls: number, notes?: Record<string, any>) {
  try {
    await q(
      `INSERT INTO ambee_usage_logs (job, job_id, ambee_calls, notes)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [job, jobId ?? null, calls, notes ? JSON.stringify(notes) : null],
    );
  } catch (err) {
    console.error('[provider usage logging] failed', {
      level: 'error',
      job,
      jobId,
      calls,
      message: (err as Error)?.message ?? String(err),
    });
  }
}

export async function upsertWeatherDaily(row: {
  city_slug: string;
  date: string; // YYYY-MM-DD
  tz?: string | null;
  temp_min_c?: number | null;
  temp_max_c?: number | null;
  temp_day_c?: number | null;
  feels_like_day_c?: number | null;
  humidity?: number | null;
  pressure_hpa?: number | null;
  wind_speed_ms?: number | null;
  wind_deg?: number | null;
  clouds_pct?: number | null;
  precip_mm?: number | null;
  uvi?: number | null;
  weather_main?: string | null;
  weather_desc?: string | null;
  aqi?: number | null;
  aqi_pm2_5?: number | null;
  aqi_pm10?: number | null;
  aqi_o3?: number | null;
  aqi_no2?: number | null;
  aqi_so2?: number | null;
  aqi_co?: number | null;
}) {
  await q(
    `INSERT INTO weather_daily (
       city_slug, date, tz, temp_min_c, temp_max_c, temp_day_c, feels_like_day_c, humidity, pressure_hpa,
       wind_speed_ms, wind_deg, clouds_pct, precip_mm, uvi, weather_main, weather_desc,
       aqi, aqi_pm2_5, aqi_pm10, aqi_o3, aqi_no2, aqi_so2, aqi_co, source
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,'openweather'
     )
     ON CONFLICT (city_slug, date, source) DO UPDATE SET
       tz = COALESCE(EXCLUDED.tz, weather_daily.tz),
       temp_min_c = EXCLUDED.temp_min_c,
       temp_max_c = EXCLUDED.temp_max_c,
       temp_day_c = EXCLUDED.temp_day_c,
       feels_like_day_c = EXCLUDED.feels_like_day_c,
       humidity = EXCLUDED.humidity,
       pressure_hpa = EXCLUDED.pressure_hpa,
       wind_speed_ms = EXCLUDED.wind_speed_ms,
       wind_deg = EXCLUDED.wind_deg,
       clouds_pct = EXCLUDED.clouds_pct,
       precip_mm = EXCLUDED.precip_mm,
       uvi = COALESCE(EXCLUDED.uvi, weather_daily.uvi),
       weather_main = COALESCE(EXCLUDED.weather_main, weather_daily.weather_main),
       weather_desc = COALESCE(EXCLUDED.weather_desc, weather_daily.weather_desc),
       aqi = EXCLUDED.aqi,
       aqi_pm2_5 = EXCLUDED.aqi_pm2_5,
       aqi_pm10 = EXCLUDED.aqi_pm10,
       aqi_o3 = EXCLUDED.aqi_o3,
       aqi_no2 = EXCLUDED.aqi_no2,
       aqi_so2 = EXCLUDED.aqi_so2,
       aqi_co = EXCLUDED.aqi_co
    `,
    [
      row.city_slug,
      row.date,
      row.tz ?? null,
      row.temp_min_c ?? null,
      row.temp_max_c ?? null,
      row.temp_day_c ?? null,
      row.feels_like_day_c ?? null,
      row.humidity ?? null,
      row.pressure_hpa ?? null,
      row.wind_speed_ms ?? null,
      row.wind_deg ?? null,
      row.clouds_pct ?? null,
      row.precip_mm ?? null,
      row.uvi ?? null,
      row.weather_main ?? null,
      row.weather_desc ?? null,
      row.aqi ?? null,
      row.aqi_pm2_5 ?? null,
      row.aqi_pm10 ?? null,
      row.aqi_o3 ?? null,
      row.aqi_no2 ?? null,
      row.aqi_so2 ?? null,
      row.aqi_co ?? null,
    ],
  );
}

