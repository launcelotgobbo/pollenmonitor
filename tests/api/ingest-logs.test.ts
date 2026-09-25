import { strict as assert } from 'node:assert';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { GET as ingestLogs } from '@/app/api/ingest-logs/route';

async function withToken<T>(fn: (headers: Record<string, string>) => Promise<T>): Promise<T> {
  const previousToken = process.env.INGEST_TOKEN;
  process.env.INGEST_TOKEN = 'test-ingest-token';
  try {
    return await fn({ 'x-ingest-token': 'test-ingest-token' });
  } finally {
    if (previousToken === undefined) delete process.env.INGEST_TOKEN;
    else process.env.INGEST_TOKEN = previousToken;
  }
}

test('ingest logs endpoint stays operator-only', async () => {
  const response = await ingestLogs(new NextRequest('http://localhost/api/ingest-logs'));
  assert.equal(response.status, 401);
});

test('ingest logs endpoint validates limit and status before querying', async () => {
  await withToken(async (headers) => {
    for (const [url, pattern] of [
      ['http://localhost/api/ingest-logs?limit=0', /'limit'/],
      ['http://localhost/api/ingest-logs?limit=201', /'limit'/],
      ['http://localhost/api/ingest-logs?limit=abc', /'limit'/],
      ['http://localhost/api/ingest-logs?status=unknown', /'status'/],
    ] as const) {
      const response = await ingestLogs(new NextRequest(url, { headers }));
      assert.equal(response.status, 400, url);
      assert.match((await response.json()).error, pattern);
    }
  });
});
