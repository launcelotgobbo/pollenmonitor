import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

export async function GET(_req: NextRequest) {
  try {
    // Probe each candidate day via the ts index instead of DISTINCT-scanning
    // the whole table (1M+ rows), which took ~10s per page load.
    const { rows } = await query<{ date: string }>(
      `WITH bounds AS (
         SELECT (min(ts) AT TIME ZONE 'UTC')::date AS min_day,
                least((max(ts) AT TIME ZONE 'UTC')::date, (now() AT TIME ZONE 'UTC')::date) AS max_day
         FROM pollen_readings_hourly
       ),
       days AS (
         SELECT generate_series(min_day, max_day, interval '1 day')::date AS day
         FROM bounds
         WHERE min_day IS NOT NULL
       )
       SELECT day::text AS date
       FROM days
       WHERE EXISTS (
         SELECT 1 FROM pollen_readings_hourly p
         WHERE p.ts >= day::timestamp AT TIME ZONE 'UTC'
           AND p.ts < (day + 1)::timestamp AT TIME ZONE 'UTC'
       )
       ORDER BY day DESC`,
    );
    return Response.json(
      { dates: rows.map((r) => r.date) },
      {
        headers: {
          // New dates appear once per daily ingest; let the CDN absorb repeat loads.
          'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
        },
      },
    );
  } catch (e: any) {
    console.error('[available-dates] error:', e);
    return new Response(JSON.stringify({ error: 'Database unavailable. Check POSTGRES_URL.' }), { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
