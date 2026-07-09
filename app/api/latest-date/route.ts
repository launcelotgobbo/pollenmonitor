import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

export async function GET(_req: NextRequest) {
  try {
    const { rows } = await query<{ date: string | null }>(
      `SELECT to_char(max(ts) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date FROM pollen_readings_hourly`,
    );
    const latest = rows[0]?.date || new Date().toISOString().slice(0, 10);
    return Response.json({ date: latest });
  } catch (e: any) {
    console.error('[latest-date] error:', e);
    return new Response(JSON.stringify({ error: 'Database unavailable. Check POSTGRES_URL.' }), { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
