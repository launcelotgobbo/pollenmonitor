import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { publicDataResponse } from '@/lib/api-response';
import { ambeeForecast48h } from '@/lib/ingest/ambee';
import {
  getSupportedCities,
  resolveCity,
  unsupportedCityResponse,
  UnsupportedCityError,
} from '@/lib/cities';
import {
  getAmbeeCallsTodayUTC,
  getForecastRows,
  logProviderUsage,
  upsertPollenForecastBatch,
} from '@/lib/db';
import { withNabRisk } from '@/lib/risk';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const QUOTA_RESERVE_FLOOR = 5;

function quota() {
  const parsed = Number(process.env.AMBEE_DAILY_QUOTA);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 200;
}

/**
 * City slugs are public, so anyone can walk every slug on a cold cache and
 * spend the whole daily quota here. Reserve a full scheduled ingest run (one
 * call per city) so on-demand refreshes can never starve the cron job.
 */
function quotaReserve(cityCount: number) {
  const override = Number(process.env.AMBEE_FORECAST_RESERVE);
  if (Number.isFinite(override) && override >= 0) return override;
  return Math.max(QUOTA_RESERVE_FLOOR, cityCount);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cityParam = searchParams.get('city');
  if (!cityParam?.trim()) {
    return Response.json({ error: 'Provide ?city=slug' }, { status: 400 });
  }

  try {
    const match = await resolveCity(cityParam);
    const city = match.slug;
    const cities = await getSupportedCities();
    const cached = await getForecastRows(city);
    const cacheAge = cached.fetchedAt ? Date.now() - Date.parse(cached.fetchedAt) : Infinity;
    if (cached.rows.length > 0 && cacheAge < CACHE_TTL_MS) {
      return publicDataResponse({
        city,
        source: 'cache',
        stale: false,
        fetchedAt: cached.fetchedAt,
        rows: cached.rows.map(withNabRisk),
      });
    }

    const used = await getAmbeeCallsTodayUTC();
    const reserve = quotaReserve(cities.length);
    if (used >= quota() - reserve) {
      console.warn('[forecast] Ambee daily quota reserve reached; serving stale cache', {
        level: 'warn',
        job: 'forecast',
        city,
        used,
        quota: quota(),
        reserve,
      });
      return publicDataResponse({
        city,
        source: 'cache',
        stale: true,
        quotaExhausted: true,
        fetchedAt: cached.fetchedAt,
        rows: cached.rows.map(withNabRisk),
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
    return publicDataResponse({
      city,
      source: 'ambee',
      stale: false,
      fetchedAt: fresh.fetchedAt,
      rows: fresh.rows.map(withNabRisk),
    });
  } catch (err) {
    if (err instanceof UnsupportedCityError) {
      return unsupportedCityResponse(err);
    }
    console.error('[forecast] error', {
      level: 'error',
      job: 'forecast',
      city: cityParam,
      message: (err as Error)?.message ?? String(err),
    });
    return Response.json({ error: 'Forecast unavailable' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
