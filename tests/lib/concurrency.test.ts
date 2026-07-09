import { strict as assert } from 'node:assert';
import test from 'node:test';
import { mapWithConcurrency } from '@/lib/ingest/concurrency';

test('mapWithConcurrency preserves input order in results', async () => {
  const items = [50, 10, 30, 5, 20];
  const results = await mapWithConcurrency(items, 3, async (ms) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    return ms * 2;
  });
  assert.deepEqual(results, [100, 20, 60, 10, 40]);
});

test('mapWithConcurrency never exceeds the concurrency limit', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 4, async () => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight--;
  });
  assert.ok(maxInFlight <= 4, `max in flight was ${maxInFlight}`);
  assert.equal(inFlight, 0);
});

test('mapWithConcurrency handles empty input', async () => {
  const results = await mapWithConcurrency([], 5, async () => 1);
  assert.deepEqual(results, []);
});
