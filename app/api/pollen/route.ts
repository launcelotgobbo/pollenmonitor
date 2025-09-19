import { NextRequest } from 'next/server';
import { supabaseGet } from '@/lib/supabaseRest';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const city = searchParams.get('city');

  try {
    if (city && date) {
      // Return hourly rows for the UTC day window
      const dayStart = new Date(`${date}T00:00:00Z`).toISOString();
      const nextDay = new Date(`${date}T00:00:00Z`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const dayEnd = nextDay.toISOString();
      const rows = await supabaseGet<Array<any>>(
        'pollen_readings_hourly',
        `select=ts,grass,tree,weed,timezone:tz,species,risk_grass,risk_tree,risk_weed&city_slug=eq.${city}&ts=gte.${dayStart}&ts=lt.${dayEnd}&order=ts.asc`,
      );
      const out = rows.map((r) => ({
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
    if (date && !city) {
      // Return one summary per city for that day: max weed across hours
      const dayStart = new Date(`${date}T00:00:00Z`).toISOString();
      const nextDay = new Date(`${date}T00:00:00Z`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const dayEnd = nextDay.toISOString();
      const rows = await supabaseGet<Array<any>>(
        'pollen_readings_hourly',
        `select=city_slug,ts,grass,tree,weed&ts=gte.${dayStart}&ts=lt.${dayEnd}`,
      );
      const byCity: Record<string, any[]> = {};
      for (const r of rows) (byCity[r.city_slug] ||= []).push(r);
      const out = Object.entries(byCity).map(([slug, arr]) => {
        const maxWeed = arr.reduce((m, r) => Math.max(m, r.weed ?? 0), 0);
        const latest = arr.sort((a, b) => a.ts.localeCompare(b.ts)).slice(-1)[0] || {};
        const count = (latest.grass ?? 0) + (latest.tree ?? 0) + (latest.weed ?? 0);
        return { city: slug, date, count, source: 'ambee', is_forecast: false, max_weed: maxWeed };
      });
      return Response.json({ date, rows: out });
    }
    return new Response(
      JSON.stringify({ error: 'Provide either ?date=YYYY-MM-DD or ?city=slug' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('[pollen] error', err);
    return new Response(JSON.stringify({ error: 'Supabase unavailable. Check env vars.' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

export const dynamic = 'force-dynamic'; // ensure API bypasses static cache
