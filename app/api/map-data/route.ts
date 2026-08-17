import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { loadTopCities } from '@/lib/ingest/cities';
import { buildMapFeatureCollection, type DailyCityRow } from '@/lib/mapData';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  let date = searchParams.get('date');
  if (date && date !== 'latest' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response(JSON.stringify({ error: 'date required (YYYY-MM-DD or latest)' }), { status: 400 });
  }

  try {
    if (!date || date === 'latest') {
      // Resolve server-side so the map can render without first fetching the
      // date list; capped at today to ignore any future-dated rows.
      const { rows: latest } = await query<{ d: string | null }>(
        `SELECT least((max(ts) AT TIME ZONE 'UTC')::date, (now() AT TIME ZONE 'UTC')::date)::text AS d
         FROM pollen_readings_hourly`,
      );
      date = latest[0]?.d || new Date().toISOString().slice(0, 10);
    }

    const base = new Date(`${date}T00:00:00Z`);
    const dayStart = base.toISOString();
    const windowEnd = new Date(base);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 3);
    const dayEnd = windowEnd.toISOString();

    // Aggregate to one row per city/day in SQL; the previous version shipped
    // every hourly row (~3k rows, ~500KB) out of the DB per request.
    const { rows } = await query<DailyCityRow>(
      `SELECT city_slug,
              ((ts AT TIME ZONE 'UTC')::date)::text AS date,
              max(tree) AS tree,
              max(grass) AS grass,
              max(weed) AS weed,
              array_remove(array_agg(DISTINCT risk_tree), NULL) AS risk_tree,
              array_remove(array_agg(DISTINCT risk_grass), NULL) AS risk_grass,
              array_remove(array_agg(DISTINCT risk_weed), NULL) AS risk_weed,
              min(tz) AS tz
       FROM pollen_readings_hourly
       WHERE ts >= $1 AND ts < $2
       GROUP BY 1, 2
       ORDER BY 1, 2`,
      [dayStart, dayEnd],
    );

    const cities = await loadTopCities();
    const coords: Record<string, [number, number]> = {};
    for (const c of cities) coords[c.slug] = [c.lon, c.lat];

    const fc = buildMapFeatureCollection(rows, coords, date);

    // The 3-day window is immutable once fully in the past; today's window is
    // still being ingested, so keep its TTL short.
    const todayUTC = new Date().toISOString().slice(0, 10);
    const windowFullyHistorical = dayEnd.slice(0, 10) <= todayUTC;
    const cacheControl = windowFullyHistorical
      ? 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800'
      : 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600';

    return Response.json({ ...fc, date }, { headers: { 'cache-control': cacheControl } });
  } catch (e: any) {
    console.error('[map-data] error', e);
    return new Response(JSON.stringify({ error: 'Database unavailable. Check POSTGRES_URL.' }), { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
