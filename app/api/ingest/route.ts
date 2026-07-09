import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { logIngest } from '@/lib/db';
import { loadTopCities } from '@/lib/ingest/cities';
import { runIngestJob } from '@/lib/ingest/run-ingest';

const CITY_GEOJSON_FILENAME = process.env.CITY_GEOJSON_FILENAME || 'us-top-175-cities.geojson';
// Ambee Pollen API v3 history only covers the past 48 hours
const AMBEE_HISTORY_HOURS = 48;

function toISODateTime(input: Date) {
  return input.toISOString().slice(0, 19).replace('T', ' ');
}

function parseUTC(value: string): Date | null {
  const normalized = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(value)
    ? value
    : `${value.replace(' ', 'T')}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-ingest-token');
  if (!process.env.INGEST_TOKEN || token !== process.env.INGEST_TOKEN) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const cityFilter = searchParams.get('city');
  const dryRun = searchParams.get('dry') === 'true';
  const includeWeather = searchParams.get('includeWeather') !== 'false';
  const hoursBack = Math.max(1, Math.min(AMBEE_HISTORY_HOURS, Number(searchParams.get('hours') || '48')));
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

  const fromDate = parseUTC(fromISO);
  const toDate = parseUTC(toISO);
  if (!fromDate || !toDate || fromDate >= toDate) {
    return new Response(
      JSON.stringify({ error: 'Invalid window: provide parseable from/to (or date) with from before to' }),
      { status: 400 },
    );
  }

  const earliest = new Date(Date.now() - AMBEE_HISTORY_HOURS * 3600 * 1000);
  if (toDate <= earliest) {
    return new Response(
      JSON.stringify({
        error: `Requested window is entirely older than the Ambee v3 history limit (past ${AMBEE_HISTORY_HOURS} hours)`,
        earliestAvailable: toISODateTime(earliest),
      }),
      { status: 400 },
    );
  }
  let windowClamped = false;
  if (fromDate < earliest) {
    fromISO = toISODateTime(earliest);
    windowClamped = true;
  }

  const jobId = randomUUID();

  if (windowClamped) {
    console.warn('[ingest manual] window clamped to Ambee history limit', {
      level: 'warn',
      job: 'manual-ingest',
      jobId,
      requestedFrom: toISODateTime(fromDate),
      clampedFrom: fromISO,
      historyHours: AMBEE_HISTORY_HOURS,
    });
  }
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
    ambeeQuota: Number(process.env.AMBEE_DAILY_QUOTA ?? '200'),
  });

  const { result, httpStatus } = await runIngestJob({
    job: 'manual-ingest',
    logLabel: '[ingest manual]',
    jobId,
    cities,
    fromISO,
    toISO,
    dryRun,
    includeWeather,
  });
  return Response.json({ ...result, windowClamped }, { status: httpStatus });
}

export const dynamic = 'force-dynamic';
