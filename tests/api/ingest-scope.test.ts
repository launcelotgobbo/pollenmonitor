import { strict as assert } from 'node:assert';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { POST as ingest } from '@/app/api/ingest/route';

const TOKEN = 'test-ingest-token';

async function withIngestToken<T>(fn: () => Promise<T>): Promise<T> {
  const previous = process.env.INGEST_TOKEN;
  process.env.INGEST_TOKEN = TOKEN;
  try {
    return await fn();
  } finally {
    if (previous === undefined) delete process.env.INGEST_TOKEN;
    else process.env.INGEST_TOKEN = previous;
  }
}

// The city is resolved after the window is validated and before any provider
// is called, so an unsupported city turns a request that passed validation
// into a 404 without touching the network or the database.
function post(query: string) {
  return ingest(
    new NextRequest(`http://localhost/api/ingest?${query}&city=atlantis`, {
      method: 'POST',
      headers: { 'x-ingest-token': TOKEN },
    }),
  );
}

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3600 * 1000).toISOString();

test('manual ingest rejects a run that excludes both pollen and weather', async () => {
  await withIngestToken(async () => {
    const response = await post('includePollen=false&includeWeather=false');
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /cannot both be false/);
  });
});

test('pollen runs stay inside the Ambee history limit', async () => {
  await withIngestToken(async () => {
    for (const [query, pattern] of [
      ['hours=49', /between 1 and 48/],
      [`from=${hoursAgo(72)}&to=${hoursAgo(60)}`, /Ambee v3 history limit/],
      [`includeWeather=false&from=${hoursAgo(72)}&to=${hoursAgo(60)}`, /Ambee v3 history limit/],
    ] as const) {
      const response = await post(query);
      assert.equal(response.status, 400, query);
      assert.match((await response.json()).error, pattern, query);
    }
  });
});

test('weather-only runs accept windows up to thirty days back', async () => {
  await withIngestToken(async () => {
    for (const query of [
      'includePollen=false&hours=720',
      `includePollen=false&from=${hoursAgo(240)}&to=${hoursAgo(216)}`,
    ]) {
      const response = await post(query);
      assert.equal(response.status, 404, `${query} should pass validation and fail on the city`);
      assert.equal((await response.json()).code, 'UNSUPPORTED_CITY');
    }

    for (const [query, pattern] of [
      ['includePollen=false&hours=721', /between 1 and 720/],
      [`includePollen=false&from=${hoursAgo(960)}&to=${hoursAgo(744)}`, /weather history limit/],
    ] as const) {
      const response = await post(query);
      assert.equal(response.status, 400, query);
      assert.match((await response.json()).error, pattern, query);
    }
  });
});
