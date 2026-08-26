import { strict as assert } from 'node:assert';
import test from 'node:test';
import { shouldRunDailyIngest } from '@/lib/ingest/schedule';

test('scheduled ingest runs at 1 AM Pacific across DST', () => {
  assert.equal(shouldRunDailyIngest(new Date('2026-01-15T09:00:00Z'), true), true);
  assert.equal(shouldRunDailyIngest(new Date('2026-07-15T08:00:00Z'), true), true);
});

test('scheduled ingest skips the extra UTC invocation', () => {
  assert.equal(shouldRunDailyIngest(new Date('2026-01-15T08:00:00Z'), true), false);
  assert.equal(shouldRunDailyIngest(new Date('2026-07-15T09:00:00Z'), true), false);
});

test('scheduled ingest runs once when 1 AM repeats at the end of DST', () => {
  assert.equal(shouldRunDailyIngest(new Date('2026-11-01T08:00:00Z'), true), true);
  assert.equal(shouldRunDailyIngest(new Date('2026-11-01T09:00:00Z'), true), false);
});

test('manual token-authenticated ingest runs at any hour', () => {
  assert.equal(shouldRunDailyIngest(new Date('2026-01-15T18:00:00Z'), false), true);
});
