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
    if (city && !date) {
      const params = new URLSearchParams();
      params.set('select', 'ts,tree,grass,weed,tz');
      params.set('city_slug', `eq.${city}`);
      params.set('order', 'ts.desc');
      params.set('limit', '1000');

      const rows = await supabaseGet<Array<any>>('pollen_readings_hourly', params.toString());
      const aggregates = new Map<
        string,
        {
          treeSum: number;
          treeCount: number;
          grassSum: number;
          grassCount: number;
          weedSum: number;
          weedCount: number;
          totalSum: number;
          totalCount: number;
          timezone: string | null;
        }
      >();

      for (const row of rows) {
        const ts = typeof row.ts === 'string' ? row.ts : null;
        const dateKey = ts ? ts.slice(0, 10) : null;
        if (!dateKey) continue;

        const tree = typeof row.tree === 'number' ? row.tree : null;
        const grass = typeof row.grass === 'number' ? row.grass : null;
        const weed = typeof row.weed === 'number' ? row.weed : null;
        const total =
          tree === null && grass === null && weed === null
            ? null
            : (tree ?? 0) + (grass ?? 0) + (weed ?? 0);

        const existing = aggregates.get(dateKey) ?? {
          treeSum: 0,
          treeCount: 0,
          grassSum: 0,
          grassCount: 0,
          weedSum: 0,
          weedCount: 0,
          totalSum: 0,
          totalCount: 0,
          timezone: null,
        };

        if (tree !== null) {
          existing.treeSum += tree;
          existing.treeCount += 1;
        }
        if (grass !== null) {
          existing.grassSum += grass;
          existing.grassCount += 1;
        }
        if (weed !== null) {
          existing.weedSum += weed;
          existing.weedCount += 1;
        }
        if (total !== null) {
          existing.totalSum += total;
          existing.totalCount += 1;
        }
        if (!existing.timezone) {
          const tz = typeof row.tz === 'string' && row.tz.trim() ? row.tz.trim() : null;
          if (tz) existing.timezone = tz;
        }

        aggregates.set(dateKey, existing);
      }

      const out = Array.from(aggregates.entries())
        .map(([dateKey, aggregate]) => {
          const avg = (sum: number, count: number) => (count > 0 ? Math.round(sum / count) : null);
          return {
            date: dateKey,
            avg_tree: avg(aggregate.treeSum, aggregate.treeCount),
            avg_grass: avg(aggregate.grassSum, aggregate.grassCount),
            avg_weed: avg(aggregate.weedSum, aggregate.weedCount),
            avg_total: avg(aggregate.totalSum, aggregate.totalCount),
            timezone: aggregate.timezone,
          };
        })
        .sort((a, b) => b.date.localeCompare(a.date));

      return Response.json({ city, rows: out });
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
