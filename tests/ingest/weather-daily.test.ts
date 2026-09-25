import { strict as assert } from 'node:assert';
import test from 'node:test';
import type { City } from '@/lib/ingest/cities';
import { ingestWeatherForCities } from '@/lib/ingest/weather-daily';

const cities: City[] = [
  { name: 'Denver', slug: 'denver', lat: 39.74, lon: -104.99 },
  { name: 'Boston', slug: 'boston', lat: 42.36, lon: -71.06 },
  { name: 'Austin', slug: 'austin', lat: 30.27, lon: -97.74 },
];

const airResponse = {
  list: [{ dt: Date.UTC(2026, 6, 7, 12) / 1000, main: { aqi: 2 }, components: { pm2_5: 10 } }],
};

async function withProvider<T>(
  summaryStatus: number,
  fn: () => Promise<T>,
): Promise<{ result: T; summaryCalls: number; airCalls: number }> {
  const originalFetch = globalThis.fetch;
  const originalConcurrency = process.env.INGEST_CONCURRENCY;
  process.env.INGEST_CONCURRENCY = '1';
  let summaryCalls = 0;
  let airCalls = 0;
  globalThis.fetch = (async (input: any) => {
    const url = String(input);
    if (url.includes('/onecall/timeline/1day')) {
      summaryCalls += 1;
      if (summaryStatus !== 200) return new Response('nope', { status: summaryStatus });
      return new Response(
        JSON.stringify({
          timezone: 'America/Denver',
          data: [{ dt: Date.UTC(2026, 6, 7, 18) / 1000, temp: { min: 10, max: 20, day: 18 } }],
        }),
        { status: 200 },
      );
    }
    airCalls += 1;
    return new Response(JSON.stringify(airResponse), { status: 200 });
  }) as typeof fetch;
  try {
    return { result: await fn(), summaryCalls, airCalls };
  } finally {
    globalThis.fetch = originalFetch;
    if (originalConcurrency === undefined) delete process.env.INGEST_CONCURRENCY;
    else process.env.INGEST_CONCURRENCY = originalConcurrency;
  }
}

const window = { fromISO: '2026-07-07T00:00:00Z', toISO: '2026-07-08T00:00:00Z', dryRun: true };

test('weather ingest keeps AQI and stops calling the daily summary after a 401', async () => {
  const { result, summaryCalls, airCalls } = await withProvider(401, () =>
    ingestWeatherForCities({ cities, ...window }),
  );

  assert.equal(summaryCalls, 1, 'only the first city should probe the summary endpoint');
  assert.equal(airCalls, 3);
  assert.equal(result.summary.wrote, 3);
  assert.equal(result.summary.failed, 0);
  assert.equal(result.summary.summaryFailures, 3);
  assert.equal(result.summary.ok, false);
  assert.equal(result.summary.openweatherCalls, 4);

  assert.match(result.cityResults[0].summaryError ?? '', /failed \(401\)/);
  assert.match(result.cityResults[1].summaryError ?? '', /^skipped: /);
  assert.ok(result.cityResults.every((r) => r.ok && r.daysFetched === 1));
});

test('weather ingest keeps probing the daily summary after a city-specific failure', async () => {
  const { result, summaryCalls } = await withProvider(404, () =>
    ingestWeatherForCities({ cities, ...window }),
  );

  assert.equal(summaryCalls, 3);
  assert.equal(result.summary.summaryFailures, 3);
  assert.ok(result.cityResults.every((r) => r.ok && /failed \(404\)/.test(r.summaryError ?? '')));
});

test('weather ingest reports success when both providers respond', async () => {
  const { result, summaryCalls } = await withProvider(200, () =>
    ingestWeatherForCities({ cities, ...window }),
  );

  assert.equal(summaryCalls, 3);
  assert.equal(result.summary.ok, true);
  assert.equal(result.summary.summaryFailures, 0);
  assert.ok(result.cityResults.every((r) => r.summaryError === undefined));
});
