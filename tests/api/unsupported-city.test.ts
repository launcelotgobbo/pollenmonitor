import { strict as assert } from 'node:assert';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { GET as getCityTypeMatrix } from '@/app/api/city-type-matrix/route';
import { GET as getForecast } from '@/app/api/forecast/route';
import { POST as runIngest } from '@/app/api/ingest/route';
import { GET as getPollen } from '@/app/api/pollen/route';
import { GET as getPollenRange } from '@/app/api/pollen-range/route';
import { GET as getWeather } from '@/app/api/weather/route';

const expected = {
  error:
    "Unsupported city 'atlantis'. Use GET /api/cities or the MCP list_cities tool to choose a supported city.",
  code: 'UNSUPPORTED_CITY',
  city: 'atlantis',
  supportedCities: '/api/cities',
  mcpTool: 'list_cities',
};

const cases = [
  ['pollen', getPollen, 'http://localhost/api/pollen?city=atlantis'],
  ['forecast', getForecast, 'http://localhost/api/forecast?city=atlantis'],
  ['weather', getWeather, 'http://localhost/api/weather?city=atlantis'],
  [
    'pollen range',
    getPollenRange,
    'http://localhost/api/pollen-range?from=2026-08-01&to=2026-08-02&city=atlantis',
  ],
  [
    'city type matrix',
    getCityTypeMatrix,
    'http://localhost/api/city-type-matrix?city=atlantis',
  ],
] as const;

for (const [name, handler, url] of cases) {
  test(`${name} returns the shared unsupported-city contract`, async () => {
    const response = await handler(new NextRequest(url));

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), expected);
  });
}

test('pollen range validates every city in a multi-city request', async () => {
  const response = await getPollenRange(
    new NextRequest(
      'http://localhost/api/pollen-range?from=2026-08-01&to=2026-08-02&city=seattle,atlantis',
    ),
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), expected);
});

test('authorized manual ingest uses the shared unsupported-city contract', async () => {
  const previousToken = process.env.INGEST_TOKEN;
  process.env.INGEST_TOKEN = 'test-ingest-token';

  try {
    const response = await runIngest(
      new NextRequest('http://localhost/api/ingest?city=atlantis', {
        method: 'POST',
        headers: { 'x-ingest-token': 'test-ingest-token' },
      }),
    );

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), expected);
  } finally {
    if (previousToken === undefined) delete process.env.INGEST_TOKEN;
    else process.env.INGEST_TOKEN = previousToken;
  }
});
