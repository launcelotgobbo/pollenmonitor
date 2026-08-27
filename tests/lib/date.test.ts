import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  formatUtcSqlTimestamp,
  parseUtcCalendarDate,
  parseUtcDate,
  parseUtcDateOrTimestamp,
} from '@/lib/date';

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

test('parseUtcCalendarDate accepts real calendar dates only', () => {
  assert.equal(
    parseUtcCalendarDate('2024-02-29')?.toISOString(),
    '2024-02-29T00:00:00.000Z',
  );
  assert.equal(parseUtcCalendarDate('2026-02-29'), null);
  assert.equal(parseUtcCalendarDate('2026-04-31'), null);
  assert.equal(parseUtcCalendarDate('0000-01-01'), null);
  assert.equal(parseUtcCalendarDate('notadate'), null);
  assert.equal(parseUtcCalendarDate('2026-8-26'), null);
});

test('parseUtcDateOrTimestamp requires a calendar date or RFC 3339 timestamp', () => {
  assert.equal(
    parseUtcDateOrTimestamp('2026-08-26T12:34:56Z')?.toISOString(),
    '2026-08-26T12:34:56.000Z',
  );
  assert.equal(
    parseUtcDateOrTimestamp('2026-08-26T12:34-07:00')?.toISOString(),
    '2026-08-26T19:34:00.000Z',
  );
  assert.equal(parseUtcDateOrTimestamp('2026-08-26T12:34'), null);
  assert.equal(parseUtcDateOrTimestamp('2026-02-30T12:34:00Z'), null);
});
