import { NextRequest } from 'next/server';
import { query, TS_ISO } from '@/lib/db';

function utcDayWindow(date: string): { dayStart: string; dayEnd: string } {
  const dayStart = new Date(`${date}T00:00:00Z`).toISOString();
  const nextDay = new Date(`${date}T00:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return { dayStart, dayEnd: nextDay.toISOString() };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const city = searchParams.get('city');

  try {
    if (city && date) {
      // Return hourly rows for the UTC day window
      const { dayStart, dayEnd } = utcDayWindow(date);
      const { rows } = await query<any>(
        `SELECT ${TS_ISO} AS ts, grass, tree, weed, tz AS timezone, species,
                risk_grass, risk_tree, risk_weed
         FROM pollen_readings_hourly
         WHERE city_slug = $1 AND ts >= $2 AND ts < $3
         ORDER BY ts ASC`,
        [city, dayStart, dayEnd],
      );
      const out = rows.map((r: any) => ({
        ts: r.ts,
        tree: r.tree ?? null,
        grass: r.grass ?? null,
        weed: r.weed ?? null,
        total: (r.grass ?? 0) + (r.tree ?? 0) + (r.weed ?? 0),
        species: r.species ?? null,
        risk_tree: r.risk_tree ?? null,
        risk_grass: r.risk_grass ?? null,
        risk_weed: r.risk_weed ?? null,
        timezone: r.timezone ?? null,
      }));
      return Response.json({ city, date, rows: out });
    }
    if (city && !date) {
      // Daily averages over the city's history (most recent 720 days)
      const { rows } = await query<any>(
        `SELECT to_char(ts AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
                round(avg(tree))::int AS avg_tree,
                round(avg(grass))::int AS avg_grass,
                round(avg(weed))::int AS avg_weed,
                round(avg(CASE
                  WHEN tree IS NULL AND grass IS NULL AND weed IS NULL THEN NULL
                  ELSE coalesce(tree, 0) + coalesce(grass, 0) + coalesce(weed, 0)
                END))::int AS avg_total,
                max(tz) AS timezone
         FROM pollen_readings_hourly
         WHERE city_slug = $1
         GROUP BY 1
         ORDER BY date DESC
         LIMIT 720`,
        [city],
      );
      return Response.json({ city, rows });
    }
    if (date && !city) {
      // One summary per city for that day: latest reading count + max weed
      const { dayStart, dayEnd } = utcDayWindow(date);
      const { rows } = await query<any>(
        `SELECT DISTINCT ON (city_slug)
                city_slug,
                coalesce(grass, 0) + coalesce(tree, 0) + coalesce(weed, 0) AS count,
                max(coalesce(weed, 0)) OVER (PARTITION BY city_slug) AS max_weed
         FROM pollen_readings_hourly
         WHERE ts >= $1 AND ts < $2
         ORDER BY city_slug, ts DESC`,
        [dayStart, dayEnd],
      );
      const out = rows.map((r: any) => ({
        city: r.city_slug,
        date,
        count: r.count,
        source: 'ambee',
        is_forecast: false,
        max_weed: r.max_weed,
      }));
      return Response.json({ date, rows: out });
    }
    return new Response(
      JSON.stringify({ error: 'Provide either ?date=YYYY-MM-DD or ?city=slug' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('[pollen] error', err);
    return new Response(JSON.stringify({ error: 'Database unavailable. Check POSTGRES_URL.' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

export const dynamic = 'force-dynamic'; // ensure API bypasses static cache
