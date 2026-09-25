// End-to-end ingest pipeline against a real Postgres: stubbed providers in,
// rows, logs, quota accounting, and health out.
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { TEST_DATABASE_URL, connectTestClient, prepareDatabase, truncateAppTables } from './setup';
import { formatUtcSqlTimestamp, parseUtcDate } from '@/lib/date';
import {
  pruneOperationalData,
  query,
  reserveAmbeeCall,
  upsertWeatherDaily,
} from '@/lib/db';
import { evaluateHealth } from '@/lib/health';
import type { City } from '@/lib/ingest/cities';
import { runIngestJob } from '@/lib/ingest/run-ingest';
import { getDailyPollenRows, getHourlyPollenRows } from '@/lib/pollen';

const skip = TEST_DATABASE_URL ? false : 'POSTGRES_TEST_URL not set';

const cities: City[] = [
  { name: 'Denver', slug: 'denver', lat: 39.74, lon: -104.99 },
  { name: 'Boston', slug: 'boston', lat: 42.36, lon: -71.06 },
];

// Mirrors the cron route: a 42 h window ending at the top of the current hour.
function ingestWindow(now = new Date()) {
  const to = new Date(now);
  to.setUTCMinutes(0, 0, 0);
  const from = new Date(to.getTime() - 42 * 3600 * 1000);
  return { fromISO: formatUtcSqlTimestamp(from), toISO: formatUtcSqlTimestamp(to) };
}

function hourlyTimestamps(fromISO: string, toISO: string): Date[] {
  const out: Date[] = [];
  const end = parseUtcDate(toISO)!;
  for (let d = parseUtcDate(fromISO)!; d <= end; d = new Date(d.getTime() + 3600 * 1000)) {
    out.push(d);
  }
  return out;
}

type ProviderOptions = {
  ambeeStatus?: number;
  ambeeStatusFor?: (lat: string | null) => number;
  timelineStatus?: number;
};

// Deterministic provider payloads: pollen counts grow with the hour index so
// averages and peaks are predictable, and Denver's tree count is offset by 100.
function stubProviders(
  { ambeeStatus = 200, ambeeStatusFor, timelineStatus = 200 }: ProviderOptions = {},
) {
  const calls = { ambee: 0, timeline: 0, air: 0 };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any) => {
    const url = new URL(String(input));
    if (url.hostname === 'api.ambeedata.com') {
      calls.ambee += 1;
      const status = ambeeStatusFor?.(url.searchParams.get('lat')) ?? ambeeStatus;
      if (status !== 200) return new Response('{"message":"Limit Exceeded"}', { status });
      const offset = url.searchParams.get('lat') === '39.74' ? 100 : 0;
      const hours = hourlyTimestamps(url.searchParams.get('from')!, url.searchParams.get('to')!);
      return Response.json({
        timezone: 'America/Denver',
        data: hours.map((ts, i) => ({
          timestamp: ts.toISOString(),
          Count: { tree_pollen: offset + i, grass_pollen: 2, weed_pollen: i % 3 },
          Species: { Tree: { Oak: offset + i } },
        })),
      });
    }
    if (url.pathname === '/data/4.0/onecall/timeline/1day') {
      calls.timeline += 1;
      if (timelineStatus !== 200) return new Response('{"cod":401}', { status: timelineStatus });
      const start = Number(url.searchParams.get('start'));
      return Response.json({
        timezone: 'America/Denver',
        data: Array.from({ length: 10 }, (_, i) => ({
          dt: start + i * 86_400 + 18 * 3600, // local noon in Denver (UTC-6)
          temp: { min: 10 + i, max: 20 + i, day: 15 + i },
          humidity: 40,
          wind_speed: 3,
          uvi: 6,
          weather: [{ main: 'Clear', description: 'clear sky' }],
        })),
      });
    }
    if (url.pathname === '/data/2.5/air_pollution/history') {
      calls.air += 1;
      const start = Number(url.searchParams.get('start'));
      const end = Number(url.searchParams.get('end'));
      const list = [];
      for (let ts = start; ts <= end; ts += 3600) {
        list.push({ dt: ts, main: { aqi: 2 }, components: { pm2_5: 8, pm10: 12 } });
      }
      return Response.json({ list });
    }
    return new Response('unexpected request', { status: 500 });
  }) as typeof fetch;
  return {
    calls,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

async function withProviderEnv<T>(fn: () => Promise<T>): Promise<T> {
  const saved = {
    AMBEE_API_KEY: process.env.AMBEE_API_KEY,
    OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY,
    USE_MOCK_DATA: process.env.USE_MOCK_DATA,
    INGEST_CONCURRENCY: process.env.INGEST_CONCURRENCY,
  };
  process.env.AMBEE_API_KEY = 'ambee-test';
  process.env.OPENWEATHER_API_KEY = 'ow-test';
  process.env.USE_MOCK_DATA = 'false';
  process.env.INGEST_CONCURRENCY = '2';
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test.before(async () => {
  if (!skip) await prepareDatabase();
});

test.beforeEach(async () => {
  if (skip) return;
  const client = await connectTestClient();
  try {
    await truncateAppTables(client);
  } finally {
    await client.end();
  }
});

test('daily ingest writes pollen, weather, logs, and usage, and health turns green', { skip }, async () => {
  const providers = stubProviders();
  try {
    const { fromISO, toISO } = ingestWindow();
    const { result, httpStatus } = await withProviderEnv(() =>
      runIngestJob({
        job: 'daily-ingest',
        logLabel: '[test]',
        jobId: 'job-1',
        cities,
        fromISO,
        toISO,
      }),
    );

    assert.equal(httpStatus, 200);
    assert.equal(result.status, 'success');
    assert.equal(result.wrote, 2);
    assert.equal(result.ambeeCalls, 2);
    assert.equal(result.weather.summary.openweatherCalls, 4);
    assert.deepEqual(providers.calls, { ambee: 2, timeline: 2, air: 2 });

    const expectedHours = hourlyTimestamps(fromISO, toISO).length;
    const { rows: pollenCounts } = await query<{ city_slug: string; n: string }>(
      `SELECT city_slug, count(*)::text AS n FROM pollen_readings_hourly GROUP BY 1 ORDER BY 1`,
    );
    assert.deepEqual(pollenCounts, [
      { city_slug: 'boston', n: String(expectedHours) },
      { city_slug: 'denver', n: String(expectedHours) },
    ]);

    const today = toISO.slice(0, 10);
    const hourly = await getHourlyPollenRows('denver', today);
    assert.ok(hourly.length > 0);
    assert.ok(hourly.every((row) => row.ts.endsWith('Z') && typeof row.risk_tree === 'string'));
    assert.ok(hourly.every((row) => (row.tree ?? 0) >= 100), 'Denver rows carry the +100 tree offset');

    // Daily rows are read from pollen_daily, which the run must have refreshed.
    assert.equal(result.pollenDaily.ok, true);
    assert.equal(result.pollenDaily.from, fromISO.slice(0, 10));
    const { rows: summaryCounts } = await query<{ city_slug: string; n: string; readings: string }>(
      `SELECT city_slug, count(*)::text AS n, sum(readings)::text AS readings FROM pollen_daily GROUP BY 1 ORDER BY 1`,
    );
    assert.deepEqual(summaryCounts, [
      { city_slug: 'boston', n: String(result.pollenDaily.rows / 2), readings: String(expectedHours) },
      { city_slug: 'denver', n: String(result.pollenDaily.rows / 2), readings: String(expectedHours) },
    ]);

    const daily = await getDailyPollenRows('denver');
    assert.ok(daily.length >= 2, 'a 42 h window spans at least two UTC days');
    assert.equal(daily.length, result.pollenDaily.rows / 2);
    const latest = daily[0];
    assert.equal(latest.date, today);
    assert.equal(latest.grass, 2);
    assert.ok((latest.peak_tree ?? 0) >= (latest.tree ?? 0));
    assert.equal(latest.species?.Tree?.Oak, latest.tree);

    const { rows: weather } = await query<{ city_slug: string; date: string; temp_max_c: string | null; aqi: number | null; uvi: string | null }>(
      `SELECT city_slug, date::text, temp_max_c::text, aqi, uvi::text FROM weather_daily ORDER BY city_slug, date`,
    );
    const denverWeather = weather.filter((w) => w.city_slug === 'denver');
    assert.ok(denverWeather.length >= 2);
    assert.ok(denverWeather.every((w) => w.temp_max_c !== null && w.aqi === 2 && w.uvi === '6'));

    const { rows: logs } = await query<{ job: string; status: string; details: any }>(
      `SELECT job, status, details FROM ingest_logs`,
    );
    assert.equal(logs.length, 1);
    assert.equal(logs[0].job, 'daily-ingest');
    assert.equal(logs[0].status, 'success');
    assert.equal(logs[0].details.wrote, 2);
    assert.equal(logs[0].details.weather.summary.summaryFailures, 0);
    assert.equal('stack' in (logs[0].details.cityResults[0] ?? {}), false);

    const { rows: usage } = await query<{ job: string; ambee_calls: number }>(
      `SELECT job, ambee_calls FROM ambee_usage_logs ORDER BY job`,
    );
    assert.deepEqual(usage, [
      { job: 'daily-ingest', ambee_calls: 2 },
      { job: 'daily-ingest-openweather', ambee_calls: 4 },
    ]);

    const health = await evaluateHealth();
    assert.equal(health.ok, true, JSON.stringify(health));
    assert.equal(health.checks.pollen?.citiesReporting, 2);
    assert.equal(health.checks.weather?.summaryCoverage, 1);
    assert.equal(health.checks.dailyIngest?.status, 'success');
  } finally {
    providers.restore();
  }
});

test('an Ambee quota failure is logged as partial and still counts the attempt', { skip }, async () => {
  const providers = stubProviders({ ambeeStatus: 429 });
  try {
    const { fromISO, toISO } = ingestWindow();
    const { result, httpStatus } = await withProviderEnv(() =>
      runIngestJob({ job: 'daily-ingest', logLabel: '[test]', jobId: 'job-2', cities, fromISO, toISO }),
    );

    assert.equal(httpStatus, 500);
    assert.equal(result.status, 'partial', 'weather still succeeded');
    assert.equal(result.failed, 2);
    assert.equal(result.ambeeCalls, 2, '429 is not retried');

    const { rows } = await query<{ n: string }>(`SELECT count(*)::text AS n FROM pollen_readings_hourly`);
    assert.equal(rows[0].n, '0');
    const { rows: logs } = await query<{ status: string }>(`SELECT status FROM ingest_logs`);
    assert.deepEqual(logs, [{ status: 'partial' }]);

    const health = await evaluateHealth();
    assert.equal(health.ok, false);
    assert.equal(health.checks.pollen?.ok, false);
    assert.equal(health.checks.dailyIngest?.ok, true, 'partial runs are not treated as failures');
  } finally {
    providers.restore();
  }
});

test('a single failing city yields a partial run with a 207', { skip }, async () => {
  const providers = stubProviders({ ambeeStatusFor: (lat) => (lat === '39.74' ? 500 : 200) });
  try {
    const { fromISO, toISO } = ingestWindow();
    const { result, httpStatus } = await withProviderEnv(() =>
      runIngestJob({ job: 'manual-ingest', logLabel: '[test]', jobId: 'job-3', cities, fromISO, toISO, includeWeather: false }),
    );
    assert.equal(httpStatus, 207);
    assert.equal(result.status, 'partial');
    assert.equal(result.ambeeCalls, 4, 'Denver: 3 attempts on 500; Boston: 1');
    const { rows } = await query<{ city_slug: string }>(`SELECT DISTINCT city_slug FROM pollen_readings_hourly`);
    assert.deepEqual(rows, [{ city_slug: 'boston' }]);
    const { rows: summary } = await query<{ city_slug: string }>(`SELECT DISTINCT city_slug FROM pollen_daily`);
    assert.deepEqual(summary, [{ city_slug: 'boston' }], 'the summary only covers cities that were written');
    const { rows: logs } = await query<{ job: string; status: string }>(`SELECT job, status FROM ingest_logs`);
    assert.deepEqual(logs, [{ job: 'manual-ingest', status: 'partial' }]);
  } finally {
    providers.restore();
  }
});

test('a failed daily summary refresh downgrades an otherwise clean run to partial', { skip }, async () => {
  const providers = stubProviders();
  await query(`ALTER TABLE pollen_daily RENAME TO pollen_daily_missing`);
  try {
    const { fromISO, toISO } = ingestWindow();
    const { result, httpStatus } = await withProviderEnv(() =>
      runIngestJob({ job: 'daily-ingest', logLabel: '[test]', jobId: 'job-3b', cities, fromISO, toISO, includeWeather: false }),
    );
    assert.equal(httpStatus, 207);
    assert.equal(result.status, 'partial');
    assert.equal(result.wrote, 2, 'hourly rows still landed');
    assert.equal(result.pollenDaily.ok, false);
    assert.match(result.pollenDaily.error, /Database query failed/);

    const { rows: logs } = await query<{ status: string; details: any }>(`SELECT status, details FROM ingest_logs`);
    assert.equal(logs[0].status, 'partial');
    assert.equal(logs[0].details.pollenDaily.ok, false);
  } finally {
    providers.restore();
    await query(`ALTER TABLE pollen_daily_missing RENAME TO pollen_daily`);
  }
});

test('dry runs touch neither data tables nor usage logs beyond the run record', { skip }, async () => {
  const providers = stubProviders();
  try {
    const { fromISO, toISO } = ingestWindow();
    const { result } = await withProviderEnv(() =>
      runIngestJob({ job: 'manual-ingest', logLabel: '[test]', jobId: 'job-4', cities, fromISO, toISO, dryRun: true }),
    );
    assert.equal(result.pollenDaily, null);
    const { rows } = await query<{ pollen: string; daily: string; weather: string; usage: string; logs: string }>(
      `SELECT (SELECT count(*) FROM pollen_readings_hourly)::text AS pollen,
              (SELECT count(*) FROM pollen_daily)::text AS daily,
              (SELECT count(*) FROM weather_daily)::text AS weather,
              (SELECT count(*) FROM ambee_usage_logs)::text AS usage,
              (SELECT count(*) FROM ingest_logs)::text AS logs`,
    );
    assert.deepEqual(rows[0], { pollen: '0', daily: '0', weather: '0', usage: '2', logs: '1' });
  } finally {
    providers.restore();
  }
});

test('forecast reservations hold the scheduled reserve only until the daily ingest has logged usage', { skip }, async () => {
  const reserve = () =>
    reserveAmbeeCall({ job: 'forecast-on-demand', jobId: 'f', dailyQuota: 10, reserve: 8 });

  assert.deepEqual(await reserve(), { reserved: true, usedBefore: 0 });
  assert.deepEqual(await reserve(), { reserved: true, usedBefore: 1 });
  assert.deepEqual(await reserve(), { reserved: false, usedBefore: 2 }, 'reserve of 8 leaves room for 2');

  await query(`INSERT INTO ambee_usage_logs (job, job_id, ambee_calls) VALUES ('daily-ingest', 'd', 2)`);
  assert.deepEqual(await reserve(), { reserved: true, usedBefore: 4 }, 'reserve released after the scheduled run');

  await query(`INSERT INTO ambee_usage_logs (job, job_id, ambee_calls) VALUES ('daily-ingest-openweather', 'd', 500)`);
  assert.deepEqual(await reserve(), { reserved: true, usedBefore: 5 }, 'OpenWeather usage does not count');

  await query(`INSERT INTO ambee_usage_logs (job, job_id, ambee_calls) VALUES ('forecast-on-demand', 'x', 4)`);
  assert.deepEqual(await reserve(), { reserved: false, usedBefore: 10 });
});

test('retention pruning deletes only rows older than the configured windows', { skip }, async () => {
  await query(
    `INSERT INTO pollen_forecast_hourly (city_slug, ts) VALUES
       ('denver', now() - interval '8 days'), ('denver', now() - interval '6 days'), ('denver', now())`,
  );
  await query(
    `INSERT INTO ambee_usage_logs (ts, job, ambee_calls) VALUES
       (now() - interval '91 days', 'daily-ingest', 1), (now() - interval '89 days', 'daily-ingest', 1)`,
  );
  await query(
    `INSERT INTO ingest_logs (ts, job, status, details) VALUES
       (now() - interval '91 days', 'daily-ingest', 'success', '{}'), (now(), 'daily-ingest', 'success', '{}')`,
  );

  assert.deepEqual(await pruneOperationalData(), { forecastRows: 1, providerUsageRows: 1, ingestLogRows: 1 });
  assert.deepEqual(await pruneOperationalData(), { forecastRows: 0, providerUsageRows: 0, ingestLogRows: 0 });
});

test('weather upserts keep One Call fields when a re-run only has air quality', { skip }, async () => {
  await upsertWeatherDaily({ city_slug: 'denver', date: '2026-09-20', temp_min_c: 5, temp_max_c: 21, uvi: 7, aqi: 2, aqi_pm2_5: 9 });
  await upsertWeatherDaily({ city_slug: 'denver', date: '2026-09-20', aqi: 3, aqi_pm2_5: 12 });

  const { rows } = await query<{ temp_min_c: string; temp_max_c: string; uvi: string; aqi: number; aqi_pm2_5: string }>(
    `SELECT temp_min_c::text, temp_max_c::text, uvi::text, aqi, aqi_pm2_5::text FROM weather_daily`,
  );
  assert.deepEqual(rows, [{ temp_min_c: '5', temp_max_c: '21', uvi: '7', aqi: 3, aqi_pm2_5: '12' }]);

  await upsertWeatherDaily({ city_slug: 'denver', date: '2026-09-20', temp_max_c: 23, aqi: 3 });
  const { rows: after } = await query<{ temp_max_c: string; aqi_pm2_5: string | null }>(
    `SELECT temp_max_c::text, aqi_pm2_5::text FROM weather_daily`,
  );
  assert.deepEqual(after, [{ temp_max_c: '23', aqi_pm2_5: null }]);
});

test('health reports degraded, not unavailable, on an empty database', { skip }, async () => {
  const health = await evaluateHealth();
  assert.equal(health.status, 'degraded');
  assert.equal(health.checks.database.ok, true);
  assert.equal(health.checks.pollen?.latestObservationAt, null);
  assert.equal(health.checks.pollen?.citiesReporting, 0);
  assert.equal(health.checks.weather?.summaryCoverage, null);
  assert.equal(health.checks.dailyIngest?.lastRunAt, null);
});
