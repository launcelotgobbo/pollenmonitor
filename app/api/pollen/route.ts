import { NextRequest } from 'next/server';
import {
  resolveCity,
  unsupportedCityResponse,
  UnsupportedCityError,
} from '@/lib/cities';
import { query } from '@/lib/db';
import { getDailyPollenRows, getHourlyPollenRows, utcDayWindow } from '@/lib/pollen';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const cityParam = searchParams.get('city');

  try {
    const city = cityParam?.trim() ? (await resolveCity(cityParam)).slug : null;

    if (city && date) {
      return Response.json({ city, date, rows: await getHourlyPollenRows(city, date) });
    }
    if (city && !date) {
      return Response.json({ city, rows: await getDailyPollenRows(city) });
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
  } catch (err: unknown) {
    if (err instanceof UnsupportedCityError) {
      return unsupportedCityResponse(err);
    }
    console.error('[pollen] error', err);
    return new Response(JSON.stringify({ error: 'Database unavailable. Check POSTGRES_URL.' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

export const dynamic = 'force-dynamic'; // ensure API bypasses static cache
