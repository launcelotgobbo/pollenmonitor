import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { logIngest } from '@/lib/db';
import { loadTopCities } from '@/lib/ingest/cities';
import { isIngestAuthorized } from '@/lib/ingest-auth';
import { runIngestJob } from '@/lib/ingest/run-ingest';

const CITY_GEOJSON_FILENAME = process.env.CITY_GEOJSON_FILENAME || 'us-top-175-cities.geojson';

export async function GET(req: NextRequest) {
  // Vercel Cron sends "Authorization: Bearer $CRON_SECRET". There is no
  // header-presence fallback: x-vercel-* headers are client-suppliable, so
  // trusting them would let anyone trigger a full paid-provider ingest.
  const cronSecret = process.env.CRON_SECRET || '';
  const authorization = req.headers.get('authorization') || '';
  const cronAuthorized = Boolean(cronSecret) && authorization === `Bearer ${cronSecret}`;
  const authorized = cronAuthorized || isIngestAuthorized(req);
  const jobId =
    req.headers.get('x-vercel-id') ||
    req.headers.get('x-vercel-cron-id') ||
    randomUUID();

  if (!authorized) {
    console.warn('[cron daily-ingest] unauthorized request', {
      level: 'warn',
      job: 'daily-ingest',
      jobId,
      ts: new Date().toISOString(),
      cronSecretConfigured: Boolean(cronSecret),
      ingestTokenConfigured: Boolean(process.env.INGEST_TOKEN),
      path: '/api/cron/daily-ingest',
    });
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const toISO = now.toISOString().slice(0, 19).replace('T', ' ');
  const fromDate = new Date(now);
  fromDate.setHours(fromDate.getHours() - 42);
  const fromISO = fromDate.toISOString().slice(0, 19).replace('T', ' ');
  const cities = await loadTopCities();

  console.log('[cron daily-ingest] start', {
    level: 'info',
    job: 'daily-ingest',
    jobId,
    ts: new Date().toISOString(),
    window: { from: fromISO, to: toISO },
    cityCount: cities.length,
    source: 'ambee-hourly',
    ambeeQuota: Number(process.env.AMBEE_DAILY_QUOTA ?? '200'),
  });

  if (cities.length === 0) {
    const failure = {
      ok: false,
      from: fromISO,
      to: toISO,
      cities: 0,
      wrote: 0,
      failed: 0,
      totalRecordsStored: 0,
      ms: 0,
      jobId,
      error: `No city definitions available. Check public/data/${CITY_GEOJSON_FILENAME} or related configuration.`,
    };
    console.error('[cron daily-ingest] abort: no cities', {
      level: 'error',
      job: 'daily-ingest',
      jobId,
      ts: new Date().toISOString(),
      error: failure.error,
    });
    await logIngest('failure', failure);
    return Response.json(failure, { status: 500 });
  }

  const { result, httpStatus } = await runIngestJob({
    job: 'daily-ingest',
    logLabel: '[cron daily-ingest]',
    jobId,
    cities,
    fromISO,
    toISO,
  });
  return Response.json(result, { status: httpStatus });
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
