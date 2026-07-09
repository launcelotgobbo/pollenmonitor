import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { logIngest } from '@/lib/db';
import { loadTopCities } from '@/lib/ingest/cities';
import { runIngestJob } from '@/lib/ingest/run-ingest';

const CITY_GEOJSON_FILENAME = process.env.CITY_GEOJSON_FILENAME || 'us-top-175-cities.geojson';

export async function GET(req: NextRequest) {
  const cronHeader =
    req.headers.get('x-vercel-cron') ||
    req.headers.get('x-vercel-schedule') ||
    req.headers.get('x-vercel-oidc-token') ||
    req.headers.get('x-vercel-proxy-signature');
  // Vercel Cron sends "Authorization: Bearer $CRON_SECRET" when the env var is
  // set; fall back to the spoofable header-presence check only when it is not.
  const cronSecret = process.env.CRON_SECRET;
  const cronAuthorized = cronSecret
    ? req.headers.get('authorization') === `Bearer ${cronSecret}`
    : Boolean(cronHeader);
  const urlToken = new URL(req.url).searchParams.get('token');
  const headerToken = req.headers.get('x-ingest-token');
  const validToken = process.env.INGEST_TOKEN;
  const envTokenPresent = Boolean(validToken && validToken.length > 0);
  const urlTokenProvided = Boolean(urlToken && urlToken.length > 0);
  const headerTokenProvided = Boolean(headerToken && headerToken.length > 0);
  const tokenMatch = Boolean(validToken && (urlToken === validToken || headerToken === validToken));
  const authorized = Boolean(cronAuthorized || tokenMatch);
  const jobId =
    req.headers.get('x-vercel-id') ||
    req.headers.get('x-vercel-cron-id') ||
    randomUUID();

  if (!authorized) {
    const vercelHeaders: Record<string, string> = {};
    for (const [k, v] of req.headers.entries()) {
      if (k.startsWith('x-vercel')) vercelHeaders[k] = v;
    }
    console.warn('[cron daily-ingest] unauthorized request', {
      level: 'warn',
      job: 'daily-ingest',
      jobId,
      ts: new Date().toISOString(),
      isCron: Boolean(cronHeader),
      cronSecretConfigured: Boolean(cronSecret),
      envTokenPresent,
      urlTokenProvided,
      headerTokenProvided,
      tokenMatch,
      path: '/api/cron/daily-ingest',
      vercelHeaders,
    });
    return new Response(
      JSON.stringify({ error: 'Unauthorized', isCron: Boolean(cronHeader), tokenProvided: urlTokenProvided || headerTokenProvided }),
      { status: 401 },
    );
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
    return new Response(JSON.stringify(failure), { status: 500 });
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
