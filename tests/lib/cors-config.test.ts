import { strict as assert } from 'node:assert';
import test from 'node:test';

test('CORS is enabled only for public read routes', async () => {
  const configModule = await import(new URL('../../next.config.mjs', import.meta.url).href);
  const entries = (await configModule.default.headers()) as Array<{
    source: string;
    headers: Array<{ key: string; value: string }>;
  }>;
  const bySource = new Map(entries.map((entry) => [entry.source, entry.headers]));

  for (const source of [
    '/api/cities',
    '/api/forecast',
    '/api/map-data',
    '/api/pollen',
    '/api/pollen-range',
    '/api/weather',
  ]) {
    const headers = bySource.get(source);
    assert.ok(headers, source);
    assert.ok(
      headers.some(
        (header: { key: string; value: string }) =>
          header.key === 'Access-Control-Allow-Origin' && header.value === '*',
      ),
      source,
    );
  }

  for (const privateSource of [
    '/api/cron/daily-ingest',
    '/api/ingest',
    '/api/ingest-logs',
  ]) {
    assert.equal(bySource.has(privateSource), false, privateSource);
  }
});
