import { NextRequest } from 'next/server';
import { dataErrorResponse } from '@/lib/api-errors';
import { query, TS_ISO } from '@/lib/db';
import { isIngestAuthorized, unauthorized } from '@/lib/ingest-auth';

export async function GET(req: NextRequest) {
  // Job details carry upstream provider errors and operational state, so this
  // stays operator-only rather than joining the public read APIs.
  if (!isIngestAuthorized(req)) return unauthorized();

  const { searchParams } = new URL(req.url);
  const limit = Math.max(1, Math.min(200, Number(searchParams.get('limit') || '20')));

  try {
    const { rows } = await query<{ ts: string; status: string; details: any }>(
      `SELECT ${TS_ISO} AS ts, status, details
       FROM ingest_logs
       ORDER BY ingest_logs.ts DESC
       LIMIT $1`,
      [limit],
    );
    return Response.json({ logs: rows });
  } catch (e: unknown) {
    return dataErrorResponse('ingest-logs', e);
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
