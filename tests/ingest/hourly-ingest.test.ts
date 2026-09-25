import { strict as assert } from 'node:assert';
import test from 'node:test';
import type { City } from '@/lib/ingest/cities';
import { ingestHourlyForCities } from '@/lib/ingest/hourly-ingest';

const cities: City[] = [
  { name: 'Denver', slug: 'denver', lat: 39.74, lon: -104.99 },
  { name: 'Boston', slug: 'boston', lat: 42.36, lon: -71.06 },
];

const ambeeResponse = {
  timezone: 'America/Denver',
  data: [{ timestamp: '2026-07-08T10:00:00.000Z', Count: { tree_pollen: 5, grass_pollen: 1, weed_pollen: 0 } }],
};

const window = { fromISO: '2026-07-08 00:00:00', toISO: '2026-07-09 00:00:00', dryRun: true };

async function withEnv<T>(
  env: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

async function withAmbee<T>(
  respond: (call: number) => Response,
  fn: () => Promise<T>,
): Promise<{ result: T; httpCalls: number }> {
  const originalFetch = globalThis.fetch;
  let httpCalls = 0;
  globalThis.fetch = (async () => respond(httpCalls++)) as typeof fetch;
  try {
    const result = await withEnv(
      { AMBEE_API_KEY: 'test-key', USE_MOCK_DATA: 'false', INGEST_CONCURRENCY: '1' },
      fn,
    );
    return { result, httpCalls };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('hourly ingest counts one Ambee call per city on a clean run', async () => {
  const { result, httpCalls } = await withAmbee(
    () => new Response(JSON.stringify(ambeeResponse), { status: 200 }),
    () => ingestHourlyForCities({ cities, ...window }),
  );
  assert.equal(httpCalls, 2);
  assert.equal(result.summary.ambeeCalls, 2);
  assert.equal(result.summary.wrote, 2);
  assert.equal(result.summary.totalRecordsStored, 2);
  assert.equal(result.summary.ok, true);
});

test('hourly ingest counts retried attempts against the Ambee quota', async () => {
  const { result, httpCalls } = await withAmbee(
    (call) =>
      call === 0
        ? new Response('upstream error', { status: 503 })
        : new Response(JSON.stringify(ambeeResponse), { status: 200 }),
    () => ingestHourlyForCities({ cities, ...window }),
  );
  assert.equal(httpCalls, 3);
  assert.equal(result.summary.ambeeCalls, 3, 'the failed first attempt still consumed quota');
  assert.equal(result.summary.failed, 0);
});

test('hourly ingest does not count a 429 as more than one call and marks the city failed', async () => {
  const { result, httpCalls } = await withAmbee(
    () => new Response('{"message":"Limit Exceeded"}', { status: 429 }),
    () => ingestHourlyForCities({ cities, ...window }),
  );
  assert.equal(httpCalls, 2);
  assert.equal(result.summary.ambeeCalls, 2);
  assert.equal(result.summary.failed, 2);
  assert.equal(result.summary.ok, false);
  assert.match(result.cityResults[0].error ?? '', /Ambee hourly range failed \(429\)/);
});

test('hourly ingest reports zero Ambee calls in mock mode', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('mock mode must not hit the network');
  }) as typeof fetch;
  try {
    const { summary } = await withEnv(
      { USE_MOCK_DATA: 'true', INGEST_CONCURRENCY: '1' },
      () => ingestHourlyForCities({ cities, ...window }),
    );
    assert.equal(summary.ambeeCalls, 0);
    assert.equal(summary.wrote, 2);
    assert.ok(summary.totalRecordsStored > 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
