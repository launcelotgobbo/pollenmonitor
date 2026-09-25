import { NextRequest } from 'next/server';
import { dataErrorResponse } from '@/lib/api-errors';
import {
  ApiValidationError,
  parseIntegerParameter,
  validationErrorResponse,
} from '@/lib/api-validation';
import { query, TS_ISO } from '@/lib/db';
import { isIngestAuthorized, unauthorized } from '@/lib/ingest-auth';

const STATUSES = new Set(['success', 'partial', 'failure']);

export async function GET(req: NextRequest) {
  // Job details carry upstream provider errors and operational state, so this
  // stays operator-only rather than joining the public read APIs.
  if (!isIngestAuthorized(req)) return unauthorized();

  const { searchParams } = new URL(req.url);
  let limit: number;
  try {
    limit = parseIntegerParameter(searchParams.get('limit'), 'limit', {
      defaultValue: 20,
      min: 1,
      max: 200,
    });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }

  const job = searchParams.get('job')?.trim() || null;
  const status = searchParams.get('status')?.trim() || null;
  if (status && !STATUSES.has(status)) {
    return validationErrorResponse(
      new ApiValidationError(
        `Invalid parameter 'status': expected one of ${[...STATUSES].join(', ')}`,
      ),
    );
  }

  try {
    const { rows } = await query<{ ts: string; job: string | null; status: string; details: any }>(
      `SELECT ${TS_ISO} AS ts, job, status, details
       FROM ingest_logs
       WHERE ($2::text IS NULL OR job = $2)
         AND ($3::text IS NULL OR status = $3)
       ORDER BY ingest_logs.ts DESC
       LIMIT $1`,
      [limit, job, status],
    );
    return Response.json({ logs: rows });
  } catch (e: unknown) {
    return dataErrorResponse('ingest-logs', e);
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
