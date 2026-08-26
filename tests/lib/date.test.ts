import { strict as assert } from 'node:assert';
import test from 'node:test';
import { formatUtcSqlTimestamp, parseUtcDate } from '@/lib/date';

test('parseUtcDate treats zone-less job timestamps as UTC', () => {
  assert.equal(
    parseUtcDate('2026-08-25 23:30:00')?.toISOString(),
    '2026-08-25T23:30:00.000Z',
  );
  assert.equal(parseUtcDate('not-a-date'), null);
});

test('formatUtcSqlTimestamp formats job windows without a timezone suffix', () => {
  assert.equal(
    formatUtcSqlTimestamp(new Date('2026-08-26T12:34:56.789Z')),
    '2026-08-26 12:34:56',
  );
});
