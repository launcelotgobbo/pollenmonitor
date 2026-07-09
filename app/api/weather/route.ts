import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get('city');
  const date = searchParams.get('date');
  try {
    if (city && date) {
      const { rows } = await query<{ row: any }>(
        `SELECT to_jsonb(w.*) AS row FROM weather_daily w
         WHERE city_slug = $1 AND date = $2
         ORDER BY date ASC`,
        [city, date],
      );
      return Response.json({ city, date, rows: rows.map((r) => r.row) });
    }
    if (city && !date) {
      const { rows } = await query<{ row: any }>(
        `SELECT to_jsonb(w.*) AS row FROM weather_daily w
         WHERE city_slug = $1
         ORDER BY date DESC
         LIMIT 365`,
        [city],
      );
      return Response.json({ city, rows: rows.map((r) => r.row) });
    }
    if (date && !city) {
      const { rows } = await query<{ row: any }>(
        `SELECT jsonb_build_object(
           'city_slug', city_slug,
           'date', date,
           'temp_day_c', temp_day_c,
           'humidity', humidity,
           'wind_speed_ms', wind_speed_ms,
           'aqi', aqi
         ) AS row
         FROM weather_daily
         WHERE date = $1`,
        [date],
      );
      return Response.json({ date, rows: rows.map((r) => r.row) });
    }
    return new Response(JSON.stringify({ error: 'Provide either ?city=slug or ?date=YYYY-MM-DD' }), { status: 400 });
  } catch (err) {
    console.error('[weather] error', err);
    return new Response(JSON.stringify({ error: 'Database unavailable. Check POSTGRES_URL.' }), { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
