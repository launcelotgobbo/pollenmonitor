import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get('city');
  const days = Math.max(1, Math.min(120, Number(searchParams.get('days') || '60')));
  if (!city) return new Response(JSON.stringify({ error: 'city required' }), { status: 400 });

  try {
    const { rows: baseRows } = await query<{ date: string }>(
      `SELECT DISTINCT (ts AT TIME ZONE 'UTC')::date::text AS date
       FROM pollen_readings_hourly
       WHERE city_slug = $1
       ORDER BY date DESC
       LIMIT $2`,
      [city, days],
    );
    const baseDates = baseRows.map((r) => r.date);
    if (baseDates.length === 0) return Response.json({ city, rows: [] });

    const earliest = baseDates[baseDates.length - 1];
    const latest = baseDates[0];
    const fromDate = new Date(`${earliest}T00:00:00Z`);
    const toDate = new Date(`${addDays(latest, 3)}T00:00:00Z`);

    const { rows: hourly } = await query<{ ts: string; grass: number | null; tree: number | null; weed: number | null }>(
      `SELECT (ts AT TIME ZONE 'UTC')::text AS ts, grass, tree, weed
       FROM pollen_readings_hourly
       WHERE city_slug = $1 AND ts >= $2 AND ts < $3`,
      [city, fromDate.toISOString(), toDate.toISOString()],
    );

    const aggregate = new Map<string, { tree: number | null; grass: number | null; weed: number | null }>();
    const bump = (current: number | null | undefined, value: number | null | undefined) => {
      if (value === null || value === undefined) return current ?? null;
      if (current === null || current === undefined) return value;
      return Math.max(current, value);
    };

    for (const row of hourly) {
      const date = row.ts?.slice(0, 10);
      if (!date) continue;
      const existing = aggregate.get(date) || { tree: null, grass: null, weed: null };
      existing.tree = bump(existing.tree, row.tree);
      existing.grass = bump(existing.grass, row.grass);
      existing.weed = bump(existing.weed, row.weed);
      aggregate.set(date, existing);
    }

    const rows = baseDates.map((d) => {
      const day0 = aggregate.get(d) || { tree: null, grass: null, weed: null };
      const day1 = aggregate.get(addDays(d, 1)) || { tree: null, grass: null, weed: null };
      const day2 = aggregate.get(addDays(d, 2)) || { tree: null, grass: null, weed: null };
      return {
        date: d,
        day0,
        day1,
        day2,
      };
    });

    return Response.json({ city, rows });
  } catch (e: any) {
    console.error('[city-type-matrix] error', e);
    return new Response(JSON.stringify({ error: 'Database unavailable. Check POSTGRES_URL.' }), { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
