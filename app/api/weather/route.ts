import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

const cityWeatherRowSql = `
  WITH pollen_tz AS (
    SELECT p.tz
    FROM pollen_readings_hourly p
    WHERE p.city_slug = $1
      AND p.tz IS NOT NULL
    ORDER BY p.ts DESC
    LIMIT 1
  )
  SELECT
  jsonb_strip_nulls(
    to_jsonb(w.*)
    || jsonb_build_object(
      'tz', coalesce(w.tz, pollen_tz.tz),
      'timezone', coalesce(w.tz, pollen_tz.tz)
    )
  ) AS row
  FROM weather_daily w
  LEFT JOIN pollen_tz ON true`;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get('city');
  const date = searchParams.get('date');
  try {
    if (city && date) {
      const { rows } = await query<{ row: any }>(
        `${cityWeatherRowSql}
         WHERE w.city_slug = $1 AND w.date = $2
         ORDER BY w.date ASC`,
        [city, date],
      );
      return Response.json({ city, date, rows: rows.map((r) => r.row) });
    }
    if (city && !date) {
      const { rows } = await query<{ row: any }>(
        `${cityWeatherRowSql}
         WHERE w.city_slug = $1
         ORDER BY w.date DESC
         LIMIT 365`,
        [city],
      );
      return Response.json({ city, rows: rows.map((r) => r.row) });
    }
    if (date && !city) {
      const { rows } = await query<{ row: any }>(
        `SELECT jsonb_strip_nulls(jsonb_build_object(
           'city_slug', city_slug,
           'date', date,
           'temp_day_c', temp_day_c,
           'humidity', humidity,
           'wind_speed_ms', wind_speed_ms,
           'aqi', aqi
         )) AS row
         FROM weather_daily
         WHERE date = $1`,
        [date],
      );
      return Response.json({ date, rows: rows.map((r) => r.row) });
    }
    return Response.json({ error: 'Provide either ?city=slug or ?date=YYYY-MM-DD' }, { status: 400 });
  } catch (err) {
    console.error('[weather] error', err);
    return Response.json({ error: 'Database unavailable. Check POSTGRES_URL.' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
