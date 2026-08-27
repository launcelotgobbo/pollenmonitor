import { NextRequest } from 'next/server';
import { dataErrorResponse } from '@/lib/api-errors';
import { query } from '@/lib/db';

export async function GET(_req: NextRequest) {
  try {
    const { rows } = await query<{ date: string | null }>(
      `SELECT to_char(max(ts) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date FROM pollen_readings_hourly`,
    );
    const latest = rows[0]?.date || new Date().toISOString().slice(0, 10);
    return Response.json(
      { date: latest },
      { headers: { 'cache-control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600' } },
    );
  } catch (e: unknown) {
    return dataErrorResponse('latest-date', e);
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
