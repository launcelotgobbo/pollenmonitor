import type { QueryResult, QueryResultRow } from 'pg';
import { API_VERSION } from '@/lib/api-version';
import { getSupportedCities } from '@/lib/cities';
import { DatabaseOperationError, classifyDatabaseError, query } from '@/lib/db';

// The daily ingest runs once a day at 1 AM Pacific and covers the previous
// 42 hours, so a healthy deployment always has a run and an observation well
// inside these windows; the slack absorbs a slow night without paging.
export const DAILY_INGEST_MAX_AGE_HOURS = 26;
export const POLLEN_MAX_AGE_HOURS = 30;
export const WEATHER_MAX_AGE_DAYS = 2;
export const MIN_CITY_COVERAGE = 0.95;

export type HealthQuery = <T extends QueryResultRow>(
  text: string,
  params?: any[],
) => Promise<QueryResult<T>>;

export type HealthRow = {
  expected_cities: string;
  latest_pollen_ts: string | null;
  pollen_cities_recent: string;
  latest_weather_date: string | null;
  weather_rows_latest: string;
  weather_summary_rows_latest: string;
  last_ingest_ts: string | null;
  last_ingest_status: string | null;
  last_ingest_wrote: string | null;
  last_ingest_failed: string | null;
};

export type HealthReport = {
  ok: boolean;
  status: 'ok' | 'degraded' | 'unavailable';
  version: string;
  ts: string;
  checks: {
    database: { ok: boolean; latencyMs: number; error?: 'connection' | 'query' };
    dailyIngest: {
      ok: boolean;
      lastRunAt: string | null;
      status: string | null;
      ageHours: number | null;
      maxAgeHours: number;
      wrote: number | null;
      failed: number | null;
    } | null;
    pollen: {
      ok: boolean;
      latestObservationAt: string | null;
      ageHours: number | null;
      maxAgeHours: number;
      citiesReporting: number;
    } | null;
    weather: {
      ok: boolean;
      latestDate: string | null;
      ageDays: number | null;
      maxAgeDays: number;
      summaryCoverage: number | null;
      expectedCities: number;
      citiesReporting: number;
      citiesWithSummary: number;
      cityCoverage: number | null;
      minCoverage: number;
    } | null;
  };
};

const ISO_UTC = `'YYYY-MM-DD"T"HH24:MI:SS"Z"'`;

// Legacy rows were written with job = 'ingest' regardless of trigger; they age
// out of the freshness window within a day of deploying the job-aware logger.
export const HEALTH_SQL = `
  WITH last_ingest AS (
    SELECT ts, status, details
    FROM ingest_logs
    WHERE job IN ('daily-ingest', 'ingest')
      AND details->>'dryRun' IS DISTINCT FROM 'true'
    ORDER BY ts DESC
    LIMIT 1
  ),
  latest_weather AS (
    SELECT max(date) AS date FROM weather_daily WHERE city_slug = ANY($1::text[])
  )
  SELECT
    cardinality($1::text[])::text AS expected_cities,
    (SELECT to_char(max(ts) AT TIME ZONE 'UTC', ${ISO_UTC}) FROM pollen_readings_hourly
       WHERE city_slug = ANY($1::text[])) AS latest_pollen_ts,
    (SELECT count(DISTINCT city_slug)
       FROM pollen_readings_hourly
       WHERE ts >= now() - make_interval(hours => ${POLLEN_MAX_AGE_HOURS})
         AND city_slug = ANY($1::text[]))::text AS pollen_cities_recent,
    (SELECT to_char(date, 'YYYY-MM-DD') FROM latest_weather) AS latest_weather_date,
    (SELECT count(DISTINCT city_slug) FROM weather_daily w, latest_weather lw
       WHERE w.date = lw.date AND city_slug = ANY($1::text[]))::text AS weather_rows_latest,
    (SELECT count(DISTINCT city_slug) FROM weather_daily w, latest_weather lw
       WHERE w.date = lw.date AND w.temp_max_c IS NOT NULL AND w.aqi IS NOT NULL
         AND city_slug = ANY($1::text[]))::text AS weather_summary_rows_latest,
    (SELECT to_char(ts AT TIME ZONE 'UTC', ${ISO_UTC}) FROM last_ingest) AS last_ingest_ts,
    (SELECT status FROM last_ingest) AS last_ingest_status,
    (SELECT details->>'wrote' FROM last_ingest) AS last_ingest_wrote,
    (SELECT details->>'failed' FROM last_ingest) AS last_ingest_failed
`;

function hoursSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const ms = now.getTime() - Date.parse(iso);
  return Number.isFinite(ms) ? Math.round(ms / 36e4) / 10 : null;
}

function utcDaysSince(date: string | null, now: Date): number | null {
  if (!date) return null;
  const then = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(then)) return null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((today - then) / 864e5);
}

function integer(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildHealthReport(
  row: HealthRow,
  latencyMs: number,
  now = new Date(),
): HealthReport {
  const expectedCities = integer(row.expected_cities) ?? 0;
  const enoughCities = (count: number) =>
    expectedCities > 0 && count / expectedCities >= MIN_CITY_COVERAGE;
  const ingestAge = hoursSince(row.last_ingest_ts, now);
  const dailyIngest = {
    ok:
      ingestAge !== null &&
      ingestAge <= DAILY_INGEST_MAX_AGE_HOURS &&
      row.last_ingest_status === 'success',
    lastRunAt: row.last_ingest_ts,
    status: row.last_ingest_status,
    ageHours: ingestAge,
    maxAgeHours: DAILY_INGEST_MAX_AGE_HOURS,
    wrote: integer(row.last_ingest_wrote),
    failed: integer(row.last_ingest_failed),
  };

  const pollenAge = hoursSince(row.latest_pollen_ts, now);
  const pollen = {
    ok:
      pollenAge !== null &&
      pollenAge <= POLLEN_MAX_AGE_HOURS &&
      enoughCities(integer(row.pollen_cities_recent) ?? 0),
    latestObservationAt: row.latest_pollen_ts,
    ageHours: pollenAge,
    maxAgeHours: POLLEN_MAX_AGE_HOURS,
    citiesReporting: integer(row.pollen_cities_recent) ?? 0,
  };

  const weatherAge = utcDaysSince(row.latest_weather_date, now);
  const weatherRows = integer(row.weather_rows_latest) ?? 0;
  const summaryRows = integer(row.weather_summary_rows_latest) ?? 0;
  const weather = {
    ok: weatherAge !== null && weatherAge <= WEATHER_MAX_AGE_DAYS && enoughCities(summaryRows),
    latestDate: row.latest_weather_date,
    ageDays: weatherAge,
    maxAgeDays: WEATHER_MAX_AGE_DAYS,
    // Coverage is against the catalog, not just the subset that wrote a row.
    summaryCoverage:
      weatherRows > 0 && expectedCities > 0
        ? Math.round((summaryRows / expectedCities) * 100) / 100
        : null,
    expectedCities,
    citiesReporting: weatherRows,
    citiesWithSummary: summaryRows,
    cityCoverage:
      expectedCities > 0 ? Math.round((weatherRows / expectedCities) * 100) / 100 : null,
    minCoverage: MIN_CITY_COVERAGE,
  };

  const ok = dailyIngest.ok && pollen.ok && weather.ok;
  return {
    ok,
    status: ok ? 'ok' : 'degraded',
    version: API_VERSION,
    ts: now.toISOString(),
    checks: {
      database: { ok: true, latencyMs },
      dailyIngest,
      pollen,
      weather,
    },
  };
}

export function unavailableHealthReport(
  kind: 'connection' | 'query',
  latencyMs: number,
  now = new Date(),
): HealthReport {
  return {
    ok: false,
    status: 'unavailable',
    version: API_VERSION,
    ts: now.toISOString(),
    checks: {
      database: { ok: false, latencyMs, error: kind },
      dailyIngest: null,
      pollen: null,
      weather: null,
    },
  };
}

export async function evaluateHealth(
  q: HealthQuery = query,
  now = new Date(),
  citySlugs?: string[],
): Promise<HealthReport> {
  const started = Date.now();
  try {
    const slugs = citySlugs ?? (await getSupportedCities()).map((city) => city.slug);
    const { rows } = await q<HealthRow>(HEALTH_SQL, [slugs]);
    return buildHealthReport(rows[0], Date.now() - started, now);
  } catch (error) {
    const kind =
      error instanceof DatabaseOperationError ? error.kind : classifyDatabaseError(error);
    console.error('[health] database check failed', {
      level: 'error',
      kind,
      code: error instanceof DatabaseOperationError ? error.code : null,
    });
    return unavailableHealthReport(kind, Date.now() - started, now);
  }
}
