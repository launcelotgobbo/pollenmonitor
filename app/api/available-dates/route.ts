import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

export async function GET(_req: NextRequest) {
  try {
    const { rows } = await query<{ date: string }>(
      `SELECT DISTINCT (ts AT TIME ZONE 'UTC')::date::text AS date
       FROM pollen_readings_hourly
       WHERE (ts AT TIME ZONE 'UTC')::date <= (now() AT TIME ZONE 'UTC')::date
       ORDER BY date DESC`,
    );
    return Response.json({ dates: rows.map((r) => r.date) });
  } catch (e: any) {
    console.error('[available-dates] error:', e);
    return new Response(JSON.stringify({ error: 'Database unavailable. Check POSTGRES_URL.' }), { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
