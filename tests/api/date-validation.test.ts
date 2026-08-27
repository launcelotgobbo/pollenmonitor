import { strict as assert } from 'node:assert';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { POST as ingest } from '@/app/api/ingest/route';
import { GET as mapData } from '@/app/api/map-data/route';
import { GET as pollenRange } from '@/app/api/pollen-range/route';
import { GET as weather } from '@/app/api/weather/route';

test('public date parameters reject invalid calendar dates before querying', async () => {
  for (const [name, handler, url] of [
    [
      'weather',
      weather,
      'http://localhost/api/weather?city=berkeley&date=2026-02-30',
    ],
    ['map data', mapData, 'http://localhost/api/map-data?date=2026-02-30'],
    [
      'pollen range',
      pollenRange,
      'http://localhost/api/pollen-range?from=2026-02-30&to=2026-03-02',
    ],
  ] as const) {
    const response = await handler(new NextRequest(url));
    const body = await response.json();

    assert.equal(response.status, 400, name);
    assert.match(body.error, /Invalid parameter/);
  }
});

test('manual ingest validates date and partial range parameters', async () => {
  const previousToken = process.env.INGEST_TOKEN;
  process.env.INGEST_TOKEN = 'test-ingest-token';

  try {
    for (const url of [
      'http://localhost/api/ingest?date=2026-02-30',
      'http://localhost/api/ingest?from=2026-08-26T00:00:00Z',
    ]) {
      const response = await ingest(
        new NextRequest(url, {
          method: 'POST',
          headers: { 'x-ingest-token': 'test-ingest-token' },
        }),
      );
      assert.equal(response.status, 400);
      assert.match((await response.json()).error, /Invalid parameter|Missing required parameter/);
    }
  } finally {
    if (previousToken === undefined) delete process.env.INGEST_TOKEN;
    else process.env.INGEST_TOKEN = previousToken;
  }
});
