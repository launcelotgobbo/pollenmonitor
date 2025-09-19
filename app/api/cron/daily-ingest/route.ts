import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { logIngest } from '@/lib/db';
import { loadTopCities } from '@/lib/ingest/cities';
import { ingestHourlyForCities } from '@/lib/ingest/hourly-ingest';

export async function GET(req: NextRequest) {
  const cronHeader =
    req.headers.get('x-vercel-cron') ||
    req.headers.get('x-vercel-schedule') ||
    req.headers.get('x-vercel-oidc-token') ||
    req.headers.get('x-vercel-proxy-signature');
  const urlToken = new URL(req.url).searchParams.get('token');
  const headerToken = req.headers.get('x-ingest-token');
  const validToken = process.env.INGEST_TOKEN;
  const envTokenPresent = Boolean(validToken && validToken.length > 0);
  const urlTokenProvided = Boolean(urlToken && urlToken.length > 0);
  const headerTokenProvided = Boolean(headerToken && headerToken.length > 0);
  const tokenMatch = Boolean(validToken && (urlToken === validToken || headerToken === validToken));
  const authorized = Boolean(cronHeader || tokenMatch);
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
  });
  const { summary, cityResults } = await ingestHourlyForCities({
    cities,
    fromISO,
    toISO,
    onCityComplete: (outcome) => {
      if (outcome.ok) {
        console.log('[cron daily-ingest] city success', {
          level: 'info',
          job: 'daily-ingest',
          jobId,
          city: outcome.city,
          hoursFetched: outcome.hoursFetched,
        });
      } else {
        console.error('[cron daily-ingest] city failure', {
          level: 'error',
          job: 'daily-ingest',
          jobId,
          city: outcome.city,
          message: outcome.error,
        });
      }
    },
  });

  const result = {
    ...summary,
    totalDaysStored: summary.totalRecordsStored,
    jobId,
    cityResults,
  };
  console.log('[cron daily-ingest] completed', {
    level: 'info',
    job: 'daily-ingest',
    jobId,
    ts: new Date().toISOString(),
    ...result,
  });
  await logIngest(result.ok ? 'success' : 'partial', result);
  return Response.json(result);
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
