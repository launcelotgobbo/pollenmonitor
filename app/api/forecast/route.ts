import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { ambeeForecast48h } from '@/lib/ingest/ambee';
import { loadTopCities } from '@/lib/ingest/cities';
import {
  getAmbeeCallsTodayUTC,
  getForecastRows,
  logProviderUsage,
  upsertPollenForecastBatch,
} from '@/lib/db';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
// Calls held back from the daily quota so scheduled ingest never gets starved
const QUOTA_RESERVE = 5;

function quota() {
  const parsed = Number(process.env.AMBEE_DAILY_QUOTA);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 200;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = (searchParams.get('city') || '').trim().toLowerCase();
  if (!city) {
    return new Response(JSON.stringify({ error: 'Provide ?city=slug' }), { status: 400 });
  }

  const cities = await loadTopCities();
  const match = cities.find((c) => c.slug === city);
  if (!match) {
    return new Response(JSON.stringify({ error: `Unknown city: ${city}` }), { status: 404 });
  }

  try {
    const cached = await getForecastRows(city);
    const cacheAge = cached.fetchedAt ? Date.now() - Date.parse(cached.fetchedAt) : Infinity;
    if (cached.rows.length > 0 && cacheAge < CACHE_TTL_MS) {
      return Response.json({
        city,
        source: 'cache',
        stale: false,
        fetchedAt: cached.fetchedAt,
        rows: cached.rows,
      });
    }

    const used = await getAmbeeCallsTodayUTC();
    if (used >= quota() - QUOTA_RESERVE) {
      console.warn('[forecast] Ambee daily quota nearly exhausted; serving stale cache', {
        level: 'warn',
        job: 'forecast',
        city,
        used,
        quota: quota(),
      });
      return Response.json({
        city,
        source: 'cache',
        stale: true,
        quotaExhausted: true,
        fetchedAt: cached.fetchedAt,
        rows: cached.rows,
      });
    }

    const jobId = randomUUID();
    const hours = await ambeeForecast48h(match.lat, match.lon);
    await logProviderUsage('forecast-on-demand', jobId, 1, { city, usedBefore: used });

    const rows = hours
      .filter((h) => h.ts)
      .map((h) => ({
        city_slug: city,
        ts: h.ts,
        tz: h.tz ?? null,
        grass: h.grass ?? null,
        tree: h.tree ?? null,
        weed: h.weed ?? null,
        risk_grass: h.risk_grass ?? null,
        risk_tree: h.risk_tree ?? null,
        risk_weed: h.risk_weed ?? null,
        species: h.species ?? null,
      }));
    await upsertPollenForecastBatch(rows);

    const fresh = await getForecastRows(city);
    return Response.json({
      city,
      source: 'ambee',
      stale: false,
      fetchedAt: fresh.fetchedAt,
      rows: fresh.rows,
    });
  } catch (err) {
    console.error('[forecast] error', {
      level: 'error',
      job: 'forecast',
      city,
      message: (err as Error)?.message ?? String(err),
    });
    return new Response(JSON.stringify({ error: 'Forecast unavailable' }), { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
