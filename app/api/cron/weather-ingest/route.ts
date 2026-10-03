import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { isBearerAuthorized, isIngestAuthorized, unauthorized } from '@/lib/ingest-auth';
import { runWeatherWorker } from '@/lib/ingest/weather-worker';

export async function GET(req: NextRequest) {
  if (!isBearerAuthorized(req, process.env.CRON_SECRET || '') && !isIngestAuthorized(req)) {
    return unauthorized();
  }
  const result = await runWeatherWorker(randomUUID());
  return Response.json(result, { status: result.ok ? 200 : 207 });
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;
