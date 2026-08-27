import { strict as assert } from 'node:assert';
import test from 'node:test';
import sitemap from '@/app/sitemap';

test('sitemap publishes the API changelog', async () => {
  const entries = await sitemap();

  assert.ok(entries.some(({ url }) => url === 'https://pollenmonitor.dev/docs/changelog'));
});
