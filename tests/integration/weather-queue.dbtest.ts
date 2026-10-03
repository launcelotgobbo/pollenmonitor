import { strict as assert } from 'node:assert';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { TEST_DATABASE_URL, prepareDatabase, connectTestClient, truncateAppTables } from './setup';
import { query, reserveOpenWeatherCall, startIngest } from '@/lib/db';
import { evaluateHealth } from '@/lib/health';
import { runIngestJob } from '@/lib/ingest/run-ingest';
import {
  claimWeatherTask,
  enqueueWeather,
  finishWeatherTask,
  pendingWeatherTasks,
} from '@/lib/ingest/weather-queue';
import { runWeatherWorker } from '@/lib/ingest/weather-worker';
import { GET as weatherCron } from '@/app/api/cron/weather-ingest/route';
import type { City } from '@/lib/ingest/cities';

const skip = TEST_DATABASE_URL ? false : 'POSTGRES_TEST_URL not set';
const cities: City[] = [
  { name: 'Denver', slug: 'denver', lat: 39.74, lon: -104.99 },
  { name: 'Boston', slug: 'boston', lat: 42.36, lon: -71.06 },
];
const from = '2026-10-02T00:00:00Z';
const to = '2026-10-02T08:00:00Z';

// No real provider or production database is used in this suite.
function weatherProvider({ hangBoston = false, empty = false } = {}) {
  const original = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = (async (input: any, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, 'api.openweathermap.org', 'weather retries must never call Ambee');
    requests.push(`${url.searchParams.get('lat')}:${url.pathname}`);
    if (hangBoston && url.searchParams.get('lat') === '42.36') {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init!.signal!;
        if (signal.aborted) {
          reject(signal.reason);
          return;
        }
        const timer = setTimeout(() => reject(new Error('test request was not aborted')), 5000);
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            reject(signal.reason);
          },
          { once: true },
        );
      });
    }
    const dt = Date.parse('2026-10-02T04:00:00Z') / 1000;
    return url.pathname.includes('/timeline/')
      ? Response.json({ data: empty ? [] : [{ dt, temp: { max: 20 } }] })
      : Response.json({ list: empty ? [] : [{ dt, main: { aqi: 2 }, components: {} }] });
  }) as typeof fetch;
  return {
    requests,
    restore: () => {
      globalThis.fetch = original;
    },
  };
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

test(
  'queue enqueue is idempotent and overlapping workers claim different cities',
  { skip },
  async () => {
    await assert.rejects(enqueueWeather(cities, to, from), /Invalid weather task window/);
    await enqueueWeather(cities, '2026-10-02 00:00:00', '2026-10-02 08:00:00');
    await enqueueWeather(cities, from, '2026-10-02T09:00:00Z');
    assert.equal(await pendingWeatherTasks(), 2);
    const tasks = await Promise.all([claimWeatherTask(), claimWeatherTask(), claimWeatherTask()]);
    const claimed = tasks.filter((task) => task !== null);
    assert.equal(claimed.length, 2);
    assert.equal(new Set(claimed.map((task) => task.id)).size, 2);
    assert.ok(claimed.every((task) => task.toISO === '2026-10-02T08:00:00.000Z'));
    assert.ok(claimed.every((task) => task.fromISO === '2026-10-02T00:00:00.000Z'));
  },
);

test(
  'expired leases can resume and stale workers cannot acknowledge reclaimed tasks',
  { skip },
  async () => {
    await enqueueWeather([cities[0]], from, to);
    const lost = (await claimWeatherTask())!;
    assert.equal(await claimWeatherTask(), null);
    await query(`UPDATE weather_ingest_tasks SET lease_until = now() - interval '1 second'`);
    const recovered = (await claimWeatherTask())!;
    assert.equal(recovered.id, lost.id);
    assert.notEqual(recovered.leaseToken, lost.leaseToken);
    await assert.rejects(finishWeatherTask(lost, true), /lease lost/);
    await finishWeatherTask(recovered, true);
    assert.equal(await pendingWeatherTasks(), 0);
    assert.equal(await claimWeatherTask(), null);
  },
);

test(
  'weather timeout checkpoints completed cities, then resumes without pollen or duplicate cities',
  { skip },
  async () => {
    const previous = process.env.INGEST_CONCURRENCY;
    process.env.INGEST_CONCURRENCY = '1';
    let provider = weatherProvider({ hangBoston: true });
    try {
      await enqueueWeather(cities, from, to);
      const first = await runWeatherWorker('interrupted', 1000);
      assert.equal(first.timedOut, true);
      assert.equal(first.completed, 1);
      assert.equal(first.pending, 1);
      assert.equal(first.status, 'partial');
      assert.equal(first.openweatherCalls, 3);
      assert.ok(first.ms >= 1000);
      assert.equal(provider.requests.length, 3, 'two Denver calls and one aborted Boston call');

      const { rows: logs } = await query(`SELECT status, details FROM ingest_logs`);
      assert.equal(logs[0].status, 'partial');
      assert.equal(logs[0].details.timedOut, true);
      assert.ok(logs[0].details.startedAt);
      const { rows: usage } = await query(
        `SELECT sum(ambee_calls)::int AS n FROM ambee_usage_logs`,
      );
      assert.equal(usage[0].n, 3, 'the interrupted attempt is accounted for');

      provider.restore();
      provider = weatherProvider();
      await query(`UPDATE weather_ingest_tasks SET available_at = now() WHERE status = 'pending'`);
      const resumed = await runWeatherWorker('resumed');
      assert.equal(resumed.ok, true);
      assert.equal(resumed.completed, 1);
      assert.equal(provider.requests.length, 2);
      assert.ok(provider.requests.every((request) => request.startsWith('42.36:')));
      const repeated = await runWeatherWorker('already-complete');
      assert.equal(repeated.completed, 0);
      assert.equal(provider.requests.length, 2);
      const { rows } = await query(`SELECT count(*)::int AS n FROM weather_daily`);
      assert.equal(rows[0].n, 2);
    } finally {
      provider.restore();
      if (previous === undefined) delete process.env.INGEST_CONCURRENCY;
      else process.env.INGEST_CONCURRENCY = previous;
    }
  },
);

test('empty provider responses are not acknowledged as completed weather', { skip }, async () => {
  const provider = weatherProvider({ empty: true });
  try {
    await enqueueWeather([cities[0]], from, to);
    const result = await runWeatherWorker('empty');
    assert.equal(result.ok, false);
    assert.equal(result.failed, 1);
    assert.equal(result.pending, 1);
    assert.equal(await claimWeatherTask(), null, 'failed tasks back off instead of hot-looping');
  } finally {
    provider.restore();
  }
});

test(
  'OpenWeather reservations are globally bounded even with concurrent workers',
  { skip },
  async () => {
    // Include usage recorded by a previous deployment before enabling reservations.
    await query(
      `INSERT INTO ambee_usage_logs (job, ambee_calls) VALUES ('daily-ingest-openweather', 1)`,
    );
    const reserved = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        reserveOpenWeatherCall('weather-ingest-openweather', `quota-${i}`, 4),
      ),
    );
    assert.equal(reserved.filter(Boolean).length, 3);
    const { rows } = await query(`SELECT sum(ambee_calls)::int AS n FROM ambee_usage_logs`);
    assert.equal(rows[0].n, 4);
  },
);

test('exhausted quota leaves resumable tasks without making any requests', { skip }, async () => {
  const previous = process.env.OPENWEATHER_DAILY_QUOTA;
  process.env.OPENWEATHER_DAILY_QUOTA = '1';
  const provider = weatherProvider();
  try {
    await reserveOpenWeatherCall('manual-ingest-openweather', 'already-spent', 1);
    await enqueueWeather(cities, from, to);
    const result = await runWeatherWorker('quota-exhausted');
    assert.equal(result.quotaExhausted, true);
    assert.equal(result.ok, false);
    assert.equal(result.pending, 2);
    assert.equal(provider.requests.length, 0);
  } finally {
    provider.restore();
    if (previous === undefined) delete process.env.OPENWEATHER_DAILY_QUOTA;
    else process.env.OPENWEATHER_DAILY_QUOTA = previous;
  }
});

test('uncompleted and unexpectedly failed ingests remain visible', { skip }, async () => {
  await startIngest('daily-ingest', { jobId: 'killed' });
  const health = await evaluateHealth(
    query,
    new Date(),
    cities.map((city) => city.slug),
  );
  assert.equal(health.checks.dailyIngest?.status, 'running');
  assert.equal(health.checks.dailyIngest?.ok, false);
  await assert.rejects(
    runIngestJob({
      job: 'daily-ingest',
      jobId: 'invalid',
      logLabel: '[test]',
      cities,
      fromISO: from,
      toISO: to,
      includePollen: false,
      includeWeather: false,
    }),
  );
  const { rows } = await query(`SELECT status FROM ingest_logs ORDER BY id`);
  assert.deepEqual(
    rows.map((row) => row.status),
    ['running', 'failure'],
  );
});

test(
  'weather cron refuses unauthenticated requests without consuming tasks',
  { skip },
  async () => {
    await enqueueWeather(cities, from, to);
    const response = await weatherCron(
      new NextRequest('https://example.com/api/cron/weather-ingest'),
    );
    assert.equal(response.status, 401);
    assert.equal(await pendingWeatherTasks(), 2);
  },
);
