import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { formatUtcSqlTimestamp, parseUtcDate } from '@/lib/date';
import { logIngest } from '@/lib/db';
import { loadTopCities } from '@/lib/ingest/cities';
import { isIngestAuthorized, unauthorized } from '@/lib/ingest-auth';
import { runIngestJob } from '@/lib/ingest/run-ingest';

const CITY_GEOJSON_FILENAME = process.env.CITY_GEOJSON_FILENAME || 'us-top-175-cities.geojson';
// Ambee Pollen API v3 history only covers the past 48 hours
const AMBEE_HISTORY_HOURS = 48;

export async function POST(req: NextRequest) {
  if (!isIngestAuthorized(req)) return unauthorized();

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
    toISO = formatUtcSqlTimestamp(end);
    fromISO = formatUtcSqlTimestamp(start);
  } else {
    const end = new Date();
    const start = new Date(end);
    start.setHours(start.getHours() - hoursBack);
    toISO = formatUtcSqlTimestamp(end);
    fromISO = formatUtcSqlTimestamp(start);
  }

  const fromDate = parseUtcDate(fromISO);
  const toDate = parseUtcDate(toISO);
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
        earliestAvailable: formatUtcSqlTimestamp(earliest),
      }),
      { status: 400 },
    );
  }
  let windowClamped = false;
  if (fromDate < earliest) {
    fromISO = formatUtcSqlTimestamp(earliest);
    windowClamped = true;
  }

  const jobId = randomUUID();

  if (windowClamped) {
    console.warn('[ingest manual] window clamped to Ambee history limit', {
      level: 'warn',
      job: 'manual-ingest',
      jobId,
      requestedFrom: formatUtcSqlTimestamp(fromDate),
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
    return Response.json(failure, { status: 500 });
  }

  const cities = allCities.filter((c) => (cityFilter ? c.slug === cityFilter : true));
  if (!cities.length) {
    return Response.json({ error: `No cities matched request for filter ${cityFilter}` }, { status: 400 });
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
