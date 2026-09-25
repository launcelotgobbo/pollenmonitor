import { strict as assert } from 'node:assert';
import test from 'node:test';
import { describeFreshness } from '@/lib/freshness';
import type { HealthReport } from '@/lib/health';

const healthy: HealthReport = {
  ok: true,
  status: 'ok',
  version: '2.5.1',
  ts: '2026-09-24T15:00:00Z',
  checks: {
    database: { ok: true, latencyMs: 4 },
    dailyIngest: {
      ok: true,
      lastRunAt: '2026-09-24T08:00:11Z',
      status: 'success',
      ageHours: 7,
      maxAgeHours: 26,
      wrote: 174,
      failed: 0,
    },
    pollen: {
      ok: true,
      latestObservationAt: '2026-09-24T07:00:00Z',
      ageHours: 8,
      maxAgeHours: 30,
      citiesReporting: 174,
    },
    weather: { ok: true, latestDate: '2026-09-24', ageDays: 0, maxAgeDays: 2, summaryCoverage: 1 },
  },
};

test('describeFreshness summarises a healthy report with the pollen age', () => {
  assert.deepEqual(describeFreshness(healthy), {
    tone: 'ok',
    label: 'Data current',
    detail: 'Pollen updated 8h ago.',
  });
});

test('describeFreshness lists each failing check in a degraded report', () => {
  const degraded: HealthReport = {
    ...healthy,
    ok: false,
    status: 'degraded',
    checks: {
      ...healthy.checks,
      pollen: { ...healthy.checks.pollen!, ok: false, ageHours: 31.5 },
      weather: { ...healthy.checks.weather!, ok: false, ageDays: 31 },
      dailyIngest: { ...healthy.checks.dailyIngest!, ok: false, status: 'failure' },
    },
  };
  assert.deepEqual(describeFreshness(degraded), {
    tone: 'warn',
    label: 'Data delayed',
    detail: 'pollen 32h ago, weather 31d old, last ingest failed',
  });
});

test('describeFreshness formats long gaps in days and missing data explicitly', () => {
  const stale: HealthReport = {
    ...healthy,
    ok: false,
    status: 'degraded',
    checks: {
      ...healthy.checks,
      pollen: { ...healthy.checks.pollen!, ok: false, ageHours: 72 },
      weather: { ...healthy.checks.weather!, ok: false, ageDays: null, latestDate: null },
      dailyIngest: { ...healthy.checks.dailyIngest!, ok: false, ageHours: null, status: null },
    },
  };
  assert.equal(describeFreshness(stale).detail, 'pollen 3d ago, weather missing, ingest no data');
});

test('describeFreshness reports an unavailable database as down', () => {
  const unavailable: HealthReport = {
    ok: false,
    status: 'unavailable',
    version: '2.5.1',
    ts: '2026-09-24T15:00:00Z',
    checks: {
      database: { ok: false, latencyMs: 10_000, error: 'connection' },
      dailyIngest: null,
      pollen: null,
      weather: null,
    },
  };
  assert.equal(describeFreshness(unavailable).tone, 'down');
  assert.equal(describeFreshness(unavailable).label, 'Status unavailable');
});
