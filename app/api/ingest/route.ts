import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import {
  ApiValidationError,
  parseCalendarDateParameter,
  parseDateTimeParameter,
  parseIntegerParameter,
  validationErrorResponse,
} from '@/lib/api-validation';
import {
  getSupportedCities,
  resolveCity,
  unsupportedCityResponse,
  UnsupportedCityError,
} from '@/lib/cities';
import { formatUtcSqlTimestamp, parseUtcDate, utcDayWindow } from '@/lib/date';
import { logIngest } from '@/lib/db';
import { isIngestAuthorized, unauthorized } from '@/lib/ingest-auth';
import type { City } from '@/lib/ingest/cities';
import { runIngestJob } from '@/lib/ingest/run-ingest';
import { ambeeDailyQuota } from '@/lib/provider-quota';

const CITY_GEOJSON_FILENAME = process.env.CITY_GEOJSON_FILENAME || 'us-top-175-cities.geojson';
// Ambee Pollen API v3 history only covers the past 48 hours
const AMBEE_HISTORY_HOURS = 48;

function requestedWindow(searchParams: URLSearchParams, hoursBack: number) {
  const explicitFrom = searchParams.get('from');
  const explicitTo = searchParams.get('to');
  if (explicitFrom || explicitTo) {
    return {
      fromISO: parseDateTimeParameter(explicitFrom, 'from').toISOString(),
      toISO: parseDateTimeParameter(explicitTo, 'to').toISOString(),
    };
  }

  const date = parseCalendarDateParameter(searchParams.get('date'), 'date');
  if (date) {
    const { dayStart, dayEnd } = utcDayWindow(date);
    return {
      fromISO: formatUtcSqlTimestamp(new Date(dayStart)),
      toISO: formatUtcSqlTimestamp(new Date(dayEnd)),
    };
  }

  const end = new Date();
  const start = new Date(end);
  start.setHours(start.getHours() - hoursBack);
  return {
    fromISO: formatUtcSqlTimestamp(start),
    toISO: formatUtcSqlTimestamp(end),
  };
}

export async function POST(req: NextRequest) {
  if (!isIngestAuthorized(req)) return unauthorized();

  const { searchParams } = new URL(req.url);
  const requestedCity = searchParams.get('city');
  const dryRun = searchParams.get('dry') === 'true';
  const includeWeather = searchParams.get('includeWeather') !== 'false';

  let toISO: string;
  let fromISO: string;

  try {
    const hoursBack = parseIntegerParameter(searchParams.get('hours'), 'hours', {
      defaultValue: AMBEE_HISTORY_HOURS,
      min: 1,
      max: AMBEE_HISTORY_HOURS,
    });
    ({ fromISO, toISO } = requestedWindow(searchParams, hoursBack));
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }

  const now = Date.now();
  const fromDate = parseUtcDate(fromISO);
  let toDate = parseUtcDate(toISO);
  if (toDate && toDate.getTime() > now) {
    // Ambee has no future readings; a far-future `to` would only widen the window.
    toDate = new Date(now);
    toISO = formatUtcSqlTimestamp(toDate);
  }
  if (!fromDate || !toDate || fromDate >= toDate) {
    return new Response(
      JSON.stringify({ error: 'Invalid window: provide parseable from/to (or date) with from before to and not in the future' }),
      { status: 400 },
    );
  }

  const earliest = new Date(now - AMBEE_HISTORY_HOURS * 3600 * 1000);
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
  let allCities: City[];
  try {
    allCities = await getSupportedCities();
  } catch (error) {
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
    console.error('[ingest manual] abort: city catalog unavailable', {
      level: 'error',
      job: 'manual-ingest',
      jobId,
      ts: new Date().toISOString(),
      error: failure.error,
      cause: error instanceof Error ? error.message : String(error),
    });
    await logIngest('manual-ingest', 'failure', failure);
    return Response.json(failure, { status: 500 });
  }

  let cities = allCities;
  if (requestedCity) {
    try {
      cities = [await resolveCity(requestedCity)];
    } catch (error) {
      if (error instanceof UnsupportedCityError) {
        return unsupportedCityResponse(error);
      }
      throw error;
    }
  }

  console.log('[ingest manual] start', {
    level: 'info',
    job: 'manual-ingest',
    jobId,
    ts: new Date().toISOString(),
    cityCount: cities.length,
    window: { from: fromISO, to: toISO },
    dryRun,
    ambeeQuota: ambeeDailyQuota(),
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
export const runtime = 'nodejs';
export const maxDuration = 300;
