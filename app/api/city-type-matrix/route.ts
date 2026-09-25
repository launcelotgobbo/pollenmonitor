import { NextRequest } from 'next/server';
import { dataErrorResponse } from '@/lib/api-errors';
import { publicDataResponse } from '@/lib/api-response';
import {
  resolveCity,
  unsupportedCityResponse,
  UnsupportedCityError,
} from '@/lib/cities';
import { query } from '@/lib/db';

const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cityParam = searchParams.get('city');
  const days = Math.max(1, Math.min(120, Number(searchParams.get('days') || '60')));
  if (!cityParam) return Response.json({ error: 'city required' }, { status: 400 });

  try {
    const city = (await resolveCity(cityParam)).slug;
    // The newest `days` dates anchor the rows; the two days after the newest
    // are fetched too so day1/day2 can be filled for it.
    const { rows: dailyRows } = await query<{
      date: string;
      tree: number | null;
      grass: number | null;
      weed: number | null;
      anchor: boolean;
    }>(
      `WITH anchors AS (
         SELECT date FROM pollen_daily WHERE city_slug = $1 ORDER BY date DESC LIMIT $2
       )
       SELECT date::text AS date, peak_tree AS tree, peak_grass AS grass, peak_weed AS weed,
              date IN (SELECT date FROM anchors) AS anchor
       FROM pollen_daily
       WHERE city_slug = $1
         AND date >= (SELECT min(date) FROM anchors)
         AND date < (SELECT max(date) FROM anchors) + 3
       ORDER BY date DESC`,
      [city, days],
    );
    const baseDates = dailyRows.filter((r) => r.anchor).map((r) => r.date);
    if (baseDates.length === 0) return publicDataResponse({ city, rows: [] });

    const aggregate = new Map(
      dailyRows.map(({ date, tree, grass, weed }) => [date, { tree, grass, weed }]),
    );

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

    return publicDataResponse({ city, rows });
  } catch (e: unknown) {
    if (e instanceof UnsupportedCityError) {
      return unsupportedCityResponse(e);
    }
    return dataErrorResponse('city-type-matrix', e);
  }
}

export const dynamic = 'force-dynamic';
