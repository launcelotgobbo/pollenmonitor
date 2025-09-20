import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { logAmbeeUsage, logIngest } from '@/lib/db';
import { loadTopCities } from '@/lib/ingest/cities';
import { ingestHourlyForCities } from '@/lib/ingest/hourly-ingest';

const CITY_GEOJSON_FILENAME = process.env.CITY_GEOJSON_FILENAME || 'us-top-175-cities.geojson';

function toISODateTime(input: Date) {
  return input.toISOString().slice(0, 19).replace('T', ' ');
}

export async function POST(req: NextRequest) {
  const ambeeQuota = Number(process.env.AMBEE_DAILY_QUOTA ?? '200');
  const token = req.headers.get('x-ingest-token');
  if (!process.env.INGEST_TOKEN || token !== process.env.INGEST_TOKEN) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const cityFilter = searchParams.get('city');
  const dryRun = searchParams.get('dry') === 'true';
  const hoursBack = Math.max(1, Math.min(168, Number(searchParams.get('hours') || '48')));
  const explicitFrom = searchParams.get('from');
  const explicitTo = searchParams.get('to');
  const dateParam = searchParams.get('date');

  let toISO: string;
  let fromISO: string;

  if (explicitFrom && explicitTo) {
    fromISO = explicitFrom;
    toISO = explicitTo;
  } else if (dateParam) {
    const start = new Date(`${dateParam}T00:00:00Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    toISO = toISODateTime(end);
    fromISO = toISODateTime(start);
  } else {
    const end = new Date();
    const start = new Date(end);
    start.setHours(start.getHours() - hoursBack);
    toISO = toISODateTime(end);
    fromISO = toISODateTime(start);
  }

  const jobId = randomUUID();
  const allCities = await loadTopCities();

  if (!allCities.length) {
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
      dryRun,
      error: `No city definitions available. Check public/data/${CITY_GEOJSON_FILENAME} or related configuration.`,
    };
    console.error('[ingest manual] abort: loadTopCities returned 0', {
      level: 'error',
      job: 'manual-ingest',
      jobId,
      ts: new Date().toISOString(),
      error: failure.error,
    });
    await logIngest('failure', failure);
    return new Response(JSON.stringify(failure), { status: 500 });
  }

  const cities = allCities.filter((c) => (cityFilter ? c.slug === cityFilter : true));
  if (!cities.length) {
    return new Response(JSON.stringify({ error: `No cities matched request for filter ${cityFilter}` }), { status: 400 });
  }

  console.log('[ingest manual] start', {
    level: 'info',
    job: 'manual-ingest',
    jobId,
    ts: new Date().toISOString(),
    cityCount: cities.length,
    window: { from: fromISO, to: toISO },
    dryRun,
    ambeeQuota,
  });

  const { summary, cityResults } = await ingestHourlyForCities({
    cities,
    fromISO,
    toISO,
    dryRun,
    onCityComplete: (outcome) => {
      if (outcome.ok) {
        console.log('[ingest manual] city success', {
          level: 'info',
          job: 'manual-ingest',
          jobId,
          city: outcome.city,
          hoursFetched: outcome.hoursFetched,
        });
      } else {
        console.error('[ingest manual] city failure', {
          level: 'error',
          job: 'manual-ingest',
          jobId,
          city: outcome.city,
          message: outcome.error,
          stack: outcome.stack,
        });
      }
    },
  });

  const status = summary.ok ? 'success' : summary.failed === cities.length ? 'failure' : 'partial';
  const result = {
    jobId,
    dryRun,
    ...summary,
    totalDaysStored: summary.totalRecordsStored,
    cityResults,
    status,
  };
  console.log('[ingest manual] completed', {
    level: 'info',
    job: 'manual-ingest',
    ts: new Date().toISOString(),
    ...result,
    status,
  });

  if (result.ambeeCalls > ambeeQuota) {
    console.warn('[ingest manual] ambee call quota exceeded', {
      level: 'warn',
      job: 'manual-ingest',
      jobId,
      ambeeCalls: result.ambeeCalls,
      quota: ambeeQuota,
    });
  }

  await logIngest(status, result);
  const httpStatus = summary.ok ? 200 : summary.failed === cities.length ? 500 : 207;
  if (result.ambeeCalls > 0) {
    await logAmbeeUsage('manual-ingest', jobId, result.ambeeCalls, {
      window: { from: fromISO, to: toISO },
      cities: cities.map((c) => c.slug),
      status,
      dryRun,
    });
  }
  return Response.json(result, { status: httpStatus });
}

export const dynamic = 'force-dynamic';
