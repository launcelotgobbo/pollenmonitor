import { NextRequest } from 'next/server';
import { supabaseGet } from '@/lib/supabaseRest';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  if (!date) return new Response(JSON.stringify({ error: 'date required' }), { status: 400 });

  try {
    const base = new Date(`${date}T00:00:00Z`);
    const dayStart = base.toISOString();
    const windowEnd = new Date(base);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 3);
    const dayEnd = windowEnd.toISOString();

    // Fetch hourly rows for the base day plus the next two days
    const hr = await supabaseGet<Array<any>>(
      'pollen_readings_hourly',
      `select=city_slug,ts,grass,tree,weed,risk_grass,risk_tree,risk_weed,tz&ts=gte.${dayStart}&ts=lt.${dayEnd}&order=ts.asc`,
    );

    // Load city coordinates from public file
    const origin = new URL(req.url).origin;
    const citiesRes = await fetch(`${origin}/data/us-top-40-cities.geojson`, { cache: 'no-store' });
    const cities = await citiesRes.json();
    const coords: Record<string, [number, number]> = {};
    for (const f of cities.features) {
      coords[f.properties.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')] = f.geometry.coordinates;
    }

    // Group by city
    const byCity: Record<string, any[]> = {};
    for (const r of hr) (byCity[r.city_slug] ||= []).push(r);

    const normalizeRisk = (value: string | null | undefined) => {
      if (!value) return null;
      return value.toString().trim().toLowerCase().replace(/\s+/g, '-').replace(/_+/g, '-');
    };

    const riskPriority: Record<string, number> = {
      'very-high': 5,
      extreme: 5,
      severe: 4,
      high: 3,
      moderate: 2,
      medium: 2,
      low: 1,
      'very-low': 0,
      minimal: 0,
    };

    const pickRisk = (current: string | null, next: string | null) => {
      const normCurrent = normalizeRisk(current);
      const normNext = normalizeRisk(next);
      const scoreCurrent = normCurrent && riskPriority[normCurrent] !== undefined ? riskPriority[normCurrent] : -1;
      const scoreNext = normNext && riskPriority[normNext] !== undefined ? riskPriority[normNext] : -1;
      if (scoreNext > scoreCurrent) return next ?? null;
      return current ?? (next ?? null);
    };

    const bumpMax = (current: number | null, value: number | null | undefined) => {
      if (value === null || value === undefined) return current ?? null;
      if (current === null || current === undefined) return value;
      return Math.max(current, value);
    };

    const features = Object.entries(byCity).map(([city, rows]) => {
      const perDay = new Map<string, any>();
      for (const r of rows) {
        const day = (r.ts || '').slice(0, 10);
        if (!day) continue;
        const existing = perDay.get(day) || {
          date: day,
          tree: null,
          grass: null,
          weed: null,
          risk_tree: null,
          risk_grass: null,
          risk_weed: null,
          timezone: r.tz ?? null,
        };
        existing.tree = bumpMax(existing.tree, r.tree ?? null);
        existing.grass = bumpMax(existing.grass, r.grass ?? null);
        existing.weed = bumpMax(existing.weed, r.weed ?? null);
        existing.risk_tree = pickRisk(existing.risk_tree, r.risk_tree ?? null);
        existing.risk_grass = pickRisk(existing.risk_grass, r.risk_grass ?? null);
        existing.risk_weed = pickRisk(existing.risk_weed, r.risk_weed ?? null);
        existing.timezone = existing.timezone || r.tz || null;
        perDay.set(day, existing);
      }

      const series = Array.from(perDay.values()).sort((a, b) => a.date.localeCompare(b.date));
      const baseDay = series.find((s) => s.date === date) || series[0] || {
        date,
        tree: null,
        grass: null,
        weed: null,
        risk_tree: null,
        risk_grass: null,
        risk_weed: null,
        timezone: rows.find((r) => r.tz)?.tz ?? null,
      };
      if (!series.length) series.push(baseDay);
      const maxWeed = baseDay.weed ?? 0;
      const timezone = baseDay.timezone ?? series.find((s) => s.timezone)?.timezone ?? null;
      const lonlat = coords[city] || [0, 0];
      return {
        type: 'Feature',
        properties: {
          city,
          count: (baseDay.grass ?? 0) + (baseDay.tree ?? 0) + (baseDay.weed ?? 0),
          tree: baseDay.tree ?? null,
          grass: baseDay.grass ?? null,
          weed: baseDay.weed ?? null,
          max_weed: maxWeed,
          risk_tree: baseDay.risk_tree ?? null,
          risk_grass: baseDay.risk_grass ?? null,
          risk_weed: baseDay.risk_weed ?? null,
          timezone,
          series,
        },
        geometry: { type: 'Point', coordinates: lonlat },
      };
    });

    return Response.json({ type: 'FeatureCollection', features });
  } catch (e: any) {
    console.error('[map-data] error', e);
    return new Response(JSON.stringify({ error: 'Supabase unavailable. Check env vars.' }), { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
