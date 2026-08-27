import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  normalizeCityList,
  parseAggregate,
  parseDate,
  toPollenRangeRows,
  type PollenRangeDbRow,
} from '@/lib/pollenRange';

test('parseDate accepts YYYY-MM-DD and coerces to midnight UTC within available range', () => {
  const result = parseDate('2025-09-20', 'from');
  assert.equal(result.toISOString(), '2025-09-20T00:00:00.000Z');
});

test('parseDate rejects invalid values', () => {
  assert.throws(() => parseDate('not-a-date', 'from'), /Invalid parameter 'from'/);
  assert.throws(() => parseDate('2026-02-30', 'from'), /Invalid parameter 'from'/);
  assert.throws(() => parseDate('2026-08-26T12:30', 'from'), /Invalid parameter 'from'/);
});

test('parseDate accepts RFC 3339 timestamps with explicit timezones', () => {
  assert.equal(
    parseDate('2026-08-26T12:30:00-07:00', 'from').toISOString(),
    '2026-08-26T19:30:00.000Z',
  );
});

test('normalizeCityList trims, lowercases and filters empty values', () => {
  const list = normalizeCityList(' Denver ,  ,San-Francisco ');
  assert.deepEqual(list, ['denver', 'san-francisco']);
});

test('parseAggregate accepts documented values and rejects unknown ones', () => {
  assert.equal(parseAggregate(null), 'none');
  assert.equal(parseAggregate('none'), 'none');
  assert.equal(parseAggregate('day'), 'day');
  assert.throws(() => parseAggregate('daily'), /expected 'none' or 'day'/);
  assert.throws(() => parseAggregate('hourly'), /expected 'none' or 'day'/);
});

test('toPollenRangeRows normalizes hourly and daily database rows identically', () => {
  const rows: PollenRangeDbRow[] = [
    {
      city_slug: 'denver',
      period_start: '2025-09-20T01:00:00.000Z',
      tree: 20,
      grass: 5,
      weed: 2,
      total: 27,
      timezone: 'America/Denver',
    },
    {
      city_slug: 'seattle',
      period_start: '2025-09-20T00:00:00.000Z',
      tree: 5,
      grass: 3,
      weed: 1,
      total: 9,
      timezone: 'America/Los_Angeles',
    },
  ];

  const result = toPollenRangeRows(rows);
  assert.deepEqual(Object.keys(result[0]), Object.keys(result[1]));
  assert.equal(result[0].city, 'denver');
  assert.equal(result[0].periodStart, '2025-09-20T01:00:00.000Z');
  assert.equal(result[0].tree, 20);
  assert.equal(result[0].total, 27);
  assert.equal(result[0].timezone, 'America/Denver');
  assert.equal(result[0].risk_tree, 'Moderate');
});
