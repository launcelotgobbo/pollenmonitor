import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  forecastInputSchema,
  pollenInputSchema,
  pollenRangeInputSchema,
  weatherInputSchema,
} from '@/lib/mcp';

test('MCP tool schemas accept bounded read-only inputs', () => {
  assert.deepEqual(pollenInputSchema.parse({ city: 'seattle', date: '2026-08-26' }), {
    city: 'seattle',
    date: '2026-08-26',
  });
  assert.deepEqual(
    pollenRangeInputSchema.parse({ from: '2026-08-01', to: '2026-08-02' }),
    {
      from: '2026-08-01',
      to: '2026-08-02',
      aggregate: 'day',
      limit: 500,
    },
  );
  assert.deepEqual(forecastInputSchema.parse({ city: 'denver' }), { city: 'denver' });
  assert.deepEqual(weatherInputSchema.parse({ city: 'portland' }), { city: 'portland' });
});

test('MCP tool schemas reject invalid dates, slugs, and excessive limits', () => {
  assert.equal(pollenInputSchema.safeParse({ city: '../seattle' }).success, false);
  assert.equal(pollenInputSchema.safeParse({ city: 'seattle', date: '2026-02-31' }).success, false);
  assert.equal(
    pollenRangeInputSchema.safeParse({
      from: '2026-08-01',
      to: '2026-08-02',
      limit: 2001,
    }).success,
    false,
  );
});
