import { strict as assert } from 'node:assert';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { PUBLIC_DATA_ERROR_MESSAGE } from '@/lib/api-errors';
import { PUBLIC_DATA_CACHE_CONTROL } from '@/lib/api-response';
import { handleForecastRequest } from '@/lib/forecast';

const city = {
  name: 'Berkeley',
  slug: 'berkeley',
  lat: 37.8715,
  lon: -122.273,
};

const staleForecast = {
  fetchedAt: '2000-01-01T00:00:00.000Z',
  rows: [
    {
      ts: '2026-08-27T05:00:00.000Z',
      tz: 'America/Los_Angeles',
      tree: 20,
      grass: 4,
      weed: 29,
      total: 53,
      risk_tree: 'Moderate',
      risk_grass: 'Low',
      risk_weed: 'Moderate',
      species: {
        Tree: { Elm: 20 },
        Grass: { Grass: 4 },
        Weed: { Ragweed: 29 },
      },
    },
  ],
};

function dependencies(
  cached: { fetchedAt: string | null; rows: any[] } = staleForecast,
  overrides: Record<string, unknown> = {},
) {
  return {
    resolveCity: async () => city,
    getSupportedCities: async () => [city],
    getForecastRows: async () => cached,
    reserveAmbeeCall: async () => ({ reserved: true, usedBefore: 0 }),
    ambeeForecast48h: async () => {
      throw new Error('Provider unavailable');
    },
    upsertPollenForecastBatch: async () => {},
    ...overrides,
  };
}

test('forecast serves stale cache when the provider refresh fails', async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const response = await handleForecastRequest(
      new NextRequest('http://localhost/api/forecast?city=berkeley'),
      dependencies(),
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get('cache-control'),
      PUBLIC_DATA_CACHE_CONTROL,
    );
    assert.equal(body.city, 'berkeley');
    assert.equal(body.source, 'cache');
    assert.equal(body.stale, true);
    assert.equal(body.quotaExhausted, undefined);
    assert.equal(body.rows.length, 1);
  } finally {
    console.error = originalError;
  }
});

test('forecast treats an empty provider response as a failed refresh', async () => {
  const originalError = console.error;
  console.error = () => {};
  let retryOptions: unknown;
  try {
    const response = await handleForecastRequest(
      new NextRequest('http://localhost/api/forecast?city=berkeley'),
      dependencies(staleForecast, {
        ambeeForecast48h: async (
          _lat: number,
          _lon: number,
          options: unknown,
        ) => {
          retryOptions = options;
          return [];
        },
      }),
    );
    const body = await response.json();

    assert.deepEqual(retryOptions, { retries: 0 });
    assert.equal(response.status, 200);
    assert.equal(body.source, 'cache');
    assert.equal(body.stale, true);
    assert.equal(body.rows.length, 1);
  } finally {
    console.error = originalError;
  }
});

test('forecast serves cache without calling the provider when quota is not reserved', async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const response = await handleForecastRequest(
      new NextRequest('http://localhost/api/forecast?city=berkeley'),
      dependencies(staleForecast, {
        reserveAmbeeCall: async () => ({ reserved: false, usedBefore: 24 }),
        ambeeForecast48h: async () => {
          throw new Error('Provider should not be called');
        },
      }),
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.source, 'cache');
    assert.equal(body.stale, true);
    assert.equal(body.quotaExhausted, true);
  } finally {
    console.warn = originalWarn;
  }
});

test('forecast returns a generic 500 when refresh fails without cached rows', async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const response = await handleForecastRequest(
      new NextRequest('http://localhost/api/forecast?city=berkeley'),
      dependencies({ fetchedAt: null, rows: [] }),
    );

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: PUBLIC_DATA_ERROR_MESSAGE });
  } finally {
    console.error = originalError;
  }
});
