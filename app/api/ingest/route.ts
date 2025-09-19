import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { logIngest } from '@/lib/db';
import { loadTopCities } from '@/lib/ingest/cities';
import { ingestHourlyForCities } from '@/lib/ingest/hourly-ingest';

function toISODateTime(input: Date) {
  return input.toISOString().slice(0, 19).replace('T', ' ');
}

export async function POST(req: NextRequest) {
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
  const cities = (await loadTopCities()).filter((c) => (cityFilter ? c.slug === cityFilter : true));
  if (!cities.length) {
    return new Response(JSON.stringify({ error: 'No cities matched request.' }), { status: 400 });
  }

  console.log('[ingest manual] start', {
    level: 'info',
    job: 'manual-ingest',
    jobId,
    ts: new Date().toISOString(),
    cityCount: cities.length,
    window: { from: fromISO, to: toISO },
    dryRun,
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
        });
      }
    },
  });

  const result = {
    jobId,
    dryRun,
    ...summary,
    totalDaysStored: summary.totalRecordsStored,
    cityResults,
  };

  console.log('[ingest manual] completed', {
    level: 'info',
    job: 'manual-ingest',
    ts: new Date().toISOString(),
    ...result,
  });

  await logIngest(summary.ok ? 'success' : 'partial', result);
  return Response.json(result);
}

export const dynamic = 'force-dynamic';
