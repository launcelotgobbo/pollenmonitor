import { strict as assert } from 'node:assert';
import test from 'node:test';
import { API_VERSION } from '@/lib/api-version';
import { DatabaseOperationError } from '@/lib/db';
import {
  DAILY_INGEST_MAX_AGE_HOURS,
  POLLEN_MAX_AGE_HOURS,
  WEATHER_MAX_AGE_DAYS,
  buildHealthReport,
  evaluateHealth,
  type HealthRow,
} from '@/lib/health';

const NOW = new Date('2026-09-24T15:00:00Z');

const freshRow: HealthRow = {
  latest_pollen_ts: '2026-09-24T07:00:00Z',
  pollen_cities_recent: '174',
  latest_weather_date: '2026-09-24',
  weather_rows_latest: '174',
  weather_summary_rows_latest: '87',
  last_ingest_ts: '2026-09-24T08:00:11Z',
  last_ingest_status: 'success',
  last_ingest_wrote: '174',
  last_ingest_failed: '0',
};

test('health report is ok when every source is inside its freshness window', () => {
  const report = buildHealthReport(freshRow, 12, NOW);

  assert.equal(report.ok, true);
  assert.equal(report.status, 'ok');
  assert.equal(report.version, API_VERSION);
  assert.deepEqual(report.checks.database, { ok: true, latencyMs: 12 });
  assert.deepEqual(report.checks.dailyIngest, {
    ok: true,
    lastRunAt: '2026-09-24T08:00:11Z',
    status: 'success',
    ageHours: 7,
    maxAgeHours: DAILY_INGEST_MAX_AGE_HOURS,
    wrote: 174,
    failed: 0,
  });
  assert.deepEqual(report.checks.pollen, {
    ok: true,
    latestObservationAt: '2026-09-24T07:00:00Z',
    ageHours: 8,
    maxAgeHours: POLLEN_MAX_AGE_HOURS,
    citiesReporting: 174,
  });
  assert.deepEqual(report.checks.weather, {
    ok: true,
    latestDate: '2026-09-24',
    ageDays: 0,
    maxAgeDays: WEATHER_MAX_AGE_DAYS,
    summaryCoverage: 0.5,
  });
});

test('health report degrades when the ingest is stale, failed, or missing', () => {
  const stale = buildHealthReport(
    { ...freshRow, last_ingest_ts: '2026-09-23T08:00:00Z' },
    5,
    NOW,
  );
  assert.equal(stale.ok, false);
  assert.equal(stale.status, 'degraded');
  assert.equal(stale.checks.dailyIngest?.ok, false);
  assert.equal(stale.checks.dailyIngest?.ageHours, 31);

  const failed = buildHealthReport({ ...freshRow, last_ingest_status: 'failure' }, 5, NOW);
  assert.equal(failed.checks.dailyIngest?.ok, false);
  assert.equal(failed.checks.pollen?.ok, true, 'other checks are independent');

  const missing = buildHealthReport(
    {
      ...freshRow,
      last_ingest_ts: null,
      last_ingest_status: null,
      last_ingest_wrote: null,
      last_ingest_failed: null,
    },
    5,
    NOW,
  );
  assert.equal(missing.checks.dailyIngest?.ok, false);
  assert.equal(missing.checks.dailyIngest?.ageHours, null);
  assert.equal(missing.checks.dailyIngest?.wrote, null);
});

test('health report degrades on stale pollen or weather data', () => {
  const stalePollen = buildHealthReport(
    { ...freshRow, latest_pollen_ts: '2026-09-23T07:00:00Z', pollen_cities_recent: '0' },
    5,
    NOW,
  );
  assert.equal(stalePollen.checks.pollen?.ok, false);
  assert.equal(stalePollen.checks.pollen?.ageHours, 32);
  assert.equal(stalePollen.checks.pollen?.citiesReporting, 0);

  const edgeWeather = buildHealthReport({ ...freshRow, latest_weather_date: '2026-09-22' }, 5, NOW);
  assert.equal(edgeWeather.checks.weather?.ok, true, 'two days old is still inside the window');
  assert.equal(edgeWeather.checks.weather?.ageDays, 2);

  const staleWeather = buildHealthReport(
    {
      ...freshRow,
      latest_weather_date: '2026-09-21',
      weather_rows_latest: '0',
      weather_summary_rows_latest: '0',
    },
    5,
    NOW,
  );
  assert.equal(staleWeather.ok, false);
  assert.equal(staleWeather.checks.weather?.ok, false);
  assert.equal(staleWeather.checks.weather?.ageDays, 3);
  assert.equal(staleWeather.checks.weather?.summaryCoverage, null);
});

test('evaluateHealth runs the freshness query and reports database failures without details', async () => {
  const seen: string[] = [];
  const healthy = await evaluateHealth(
    (async (text: string) => {
      seen.push(text);
      return { rows: [freshRow], rowCount: 1 } as any;
    }) as any,
    NOW,
  );
  assert.equal(healthy.ok, true);
  assert.equal(seen.length, 1);
  assert.match(seen[0], /FROM ingest_logs/);
  assert.match(seen[0], /FROM pollen_readings_hourly/);
  assert.match(seen[0], /FROM weather_daily/);

  const originalError = console.error;
  const logged: unknown[] = [];
  console.error = (...args: unknown[]) => {
    logged.push(args);
  };
  try {
    const unavailable = await evaluateHealth(
      (async () => {
        throw new DatabaseOperationError('connection', 'ECONNREFUSED', new Error('secret host'));
      }) as any,
      NOW,
    );
    assert.equal(unavailable.ok, false);
    assert.equal(unavailable.status, 'unavailable');
    assert.deepEqual(unavailable.checks.database, {
      ok: false,
      latencyMs: unavailable.checks.database.latencyMs,
      error: 'connection',
    });
    assert.equal(unavailable.checks.dailyIngest, null);
    assert.equal(unavailable.checks.pollen, null);
    assert.equal(unavailable.checks.weather, null);
    assert.equal(JSON.stringify(unavailable).includes('secret host'), false);
    assert.equal(logged.length, 1);
  } finally {
    console.error = originalError;
  }
});
