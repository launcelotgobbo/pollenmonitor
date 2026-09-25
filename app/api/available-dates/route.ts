import { NextRequest } from 'next/server';
import { dataErrorResponse } from '@/lib/api-errors';
import { query } from '@/lib/db';

export async function GET(_req: NextRequest) {
  try {
    // Capped at today to ignore any future-dated rows.
    const { rows } = await query<{ date: string }>(
      `SELECT DISTINCT date::text AS date
       FROM pollen_daily
       WHERE date <= (now() AT TIME ZONE 'UTC')::date
       ORDER BY 1 DESC`,
    );
    return Response.json(
      { dates: rows.map((r) => r.date) },
      {
        headers: {
          // New dates appear once per daily ingest; let the CDN absorb repeat loads.
          'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
        },
      },
    );
  } catch (e: unknown) {
    return dataErrorResponse('available-dates', e);
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
