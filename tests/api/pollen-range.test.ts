import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  aggregateDaily,
  normalizeCityList,
  parseDate,
  type HourlyRow,
} from '@/lib/pollenRange';

test('parseDate accepts YYYY-MM-DD and coerces to midnight UTC within available range', () => {
  const result = parseDate('2025-09-20', 'from');
  assert.equal(result.toISOString(), '2025-09-20T00:00:00.000Z');
});

test('parseDate rejects invalid values', () => {
  assert.throws(() => parseDate('not-a-date', 'from'), /Invalid date value/);
});

test('normalizeCityList trims, lowercases and filters empty values', () => {
  const list = normalizeCityList(' Denver ,  ,San-Francisco ');
  assert.deepEqual(list, ['denver', 'san-francisco']);
});

test('aggregateDaily groups hourly rows per city and day', () => {
  const rows: HourlyRow[] = [
    {
      city_slug: 'denver',
      ts: '2025-09-20T01:00:00.000Z',
      tree: 10,
      grass: 5,
      weed: 0,
      risk_tree: 'low',
      risk_grass: 'low',
      risk_weed: null,
      tz: 'America/Denver',
    },
    {
      city_slug: 'denver',
      ts: '2025-09-20T02:00:00.000Z',
      tree: 20,
      grass: 0,
      weed: 2,
      risk_tree: 'moderate',
      risk_grass: null,
      risk_weed: 'low',
      tz: 'America/Denver',
    },
    {
      city_slug: 'denver',
      ts: '2025-09-21T02:00:00.000Z',
      tree: null,
      grass: null,
      weed: null,
      risk_tree: null,
      risk_grass: null,
      risk_weed: null,
      tz: 'America/Denver',
    },
    {
      city_slug: 'seattle',
      ts: '2025-09-20T05:00:00.000Z',
      tree: 5,
      grass: 3,
      weed: 1,
      risk_tree: 'low',
      risk_grass: 'low',
      risk_weed: 'low',
      tz: 'America/Los_Angeles',
    },
  ];

  const result = aggregateDaily(rows);

  assert.equal(result.length, 2);
  const denver = result.find((item) => item.city === 'denver');
  assert.ok(denver);
  assert.equal(denver!.data.length, 2);
  const firstDay = denver!.data[0];
  assert.equal(firstDay.date, '2025-09-20');
  assert.equal(firstDay.avg_tree, Math.round((10 + 20) / 2));
  assert.equal(firstDay.avg_grass, Math.round((5 + 0) / 2));
  assert.equal(firstDay.avg_weed, Math.round((0 + 2) / 2));
  assert.equal(firstDay.avg_total, Math.round((15 + 22) / 2));
  assert.equal(firstDay.timezone, 'America/Denver');

  const emptyDay = denver!.data.find((item) => item.date === '2025-09-21');
  assert.ok(emptyDay);
  assert.equal(emptyDay!.avg_total, null);

  const seattle = result.find((item) => item.city === 'seattle');
  assert.ok(seattle);
  assert.equal(seattle!.data.length, 1);
  assert.equal(seattle!.data[0].avg_total, 9);
});
