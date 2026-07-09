import { strict as assert } from 'node:assert';
import test from 'node:test';
import { ambeeHourlyRange } from '@/lib/ingest/ambee';

type FetchStub = (input: any, init?: any) => Promise<Response>;

async function withStubbedFetch<T>(stub: FetchStub, fn: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.AMBEE_API_KEY;
  const originalMock = process.env.USE_MOCK_DATA;
  process.env.AMBEE_API_KEY = 'test-key';
  process.env.USE_MOCK_DATA = 'false';
  globalThis.fetch = stub as typeof fetch;
  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.AMBEE_API_KEY;
    else process.env.AMBEE_API_KEY = originalKey;
    if (originalMock === undefined) delete process.env.USE_MOCK_DATA;
    else process.env.USE_MOCK_DATA = originalMock;
  }
}

const v3Response = {
  message: 'success',
  lat: 39.74,
  lng: -104.99,
  timezone: 'America/Denver',
  data: [
    {
      timestamp: '2026-07-08T10:00:00.000Z',
      unixTs: 1783504800,
      Risk: { tree_pollen: 'Moderate', weed_pollen: 'Low', grass_pollen: 'Low' },
      Count: { tree_pollen: 78, weed_pollen: 0, grass_pollen: 4 },
      Species: {
        Tree: { Oak: 40, Pine: 38 },
        Weed: { Ragweed: 0 },
        Grass: { Grass: 4 },
        Others: 2,
      },
    },
    {
      unixTs: 1783508400,
      Risk: { tree_pollen: 'Low' },
      Count: { tree_pollen: 12 },
    },
  ],
};

test('ambeeHourlyRange calls the v3 history endpoint with locale enabled', async () => {
  let requestedUrl = '';
  let requestHeaders: Record<string, string> = {};
  await withStubbedFetch(
    async (input, init) => {
      requestedUrl = String(input);
      requestHeaders = (init?.headers ?? {}) as Record<string, string>;
      return new Response(JSON.stringify(v3Response), { status: 200 });
    },
    () => ambeeHourlyRange(39.74, -104.99, '2026-07-08 00:00:00', '2026-07-09 00:00:00'),
  );

  const url = new URL(requestedUrl);
  assert.equal(url.origin, 'https://api.ambeedata.com');
  assert.equal(url.pathname, '/v3/pollen/history');
  assert.equal(url.searchParams.get('lat'), '39.74');
  assert.equal(url.searchParams.get('lng'), '-104.99');
  assert.equal(url.searchParams.get('from'), '2026-07-08 00:00:00');
  assert.equal(url.searchParams.get('to'), '2026-07-09 00:00:00');
  assert.equal(url.searchParams.get('locale'), 'true');
  assert.equal(requestHeaders['x-api-key'], 'test-key');
});

test('ambeeHourlyRange maps the v3 response shape', async () => {
  const rows = await withStubbedFetch(
    async () => new Response(JSON.stringify(v3Response), { status: 200 }),
    () => ambeeHourlyRange(39.74, -104.99, '2026-07-08 00:00:00', '2026-07-09 00:00:00'),
  );

  assert.equal(rows.length, 2);
  const [first, second] = rows;
  assert.equal(first.ts, '2026-07-08T10:00:00.000Z');
  assert.equal(first.tz, 'America/Denver');
  assert.equal(first.tree, 78);
  assert.equal(first.grass, 4);
  assert.equal(first.weed, 0);
  assert.equal(first.risk_tree, 'Moderate');
  assert.equal(first.risk_grass, 'Low');
  assert.equal(first.risk_weed, 'Low');
  assert.deepEqual(first.species?.Tree, { Oak: 40, Pine: 38 });

  assert.equal(second.ts, new Date(1783508400 * 1000).toISOString());
  assert.equal(second.tz, 'America/Denver');
  assert.equal(second.tree, 12);
  assert.equal(second.grass, null);
  assert.equal(second.risk_weed, null);
});

test('ambeeHourlyRange throws with status and body on API failure', async () => {
  await assert.rejects(
    withStubbedFetch(
      async () => new Response('{"message":"Limit Exceeded"}', { status: 429 }),
      () => ambeeHourlyRange(39.74, -104.99, '2026-07-08 00:00:00', '2026-07-09 00:00:00'),
    ),
    /Ambee hourly range failed \(429\).*Limit Exceeded/,
  );
});

test('ambeeHourlyRange returns hourly mock data when USE_MOCK_DATA is enabled', async () => {
  const originalMock = process.env.USE_MOCK_DATA;
  process.env.USE_MOCK_DATA = 'true';
  try {
    const rows = await ambeeHourlyRange(
      39.74,
      -104.99,
      '2026-07-08T00:00:00Z',
      '2026-07-08T05:00:00Z',
    );
    assert.equal(rows.length, 6);
    for (const row of rows) {
      assert.ok(typeof row.grass === 'number');
      assert.ok(typeof row.tree === 'number');
      assert.ok(typeof row.weed === 'number');
    }
  } finally {
    if (originalMock === undefined) delete process.env.USE_MOCK_DATA;
    else process.env.USE_MOCK_DATA = originalMock;
  }
});
