import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { dataErrorResponse } from '@/lib/api-errors';
import { publicDataResponse } from '@/lib/api-response';
import {
  getSupportedCities,
  resolveCity,
  unsupportedCityResponse,
  UnsupportedCityError,
} from '@/lib/cities';
import {
  getForecastRows,
  reserveAmbeeCall,
  upsertPollenForecastBatch,
} from '@/lib/db';
import { ambeeForecast48h } from '@/lib/ingest/ambee';
import { toStoredPollenRow } from '@/lib/ingest/pollen-row';
import { ambeeDailyQuota, ambeeForecastReserve } from '@/lib/provider-quota';
import { withNabRisk } from '@/lib/risk';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type ForecastDependencies = {
  ambeeForecast48h: typeof ambeeForecast48h;
  getForecastRows: typeof getForecastRows;
  getSupportedCities: typeof getSupportedCities;
  reserveAmbeeCall: typeof reserveAmbeeCall;
  resolveCity: typeof resolveCity;
  upsertPollenForecastBatch: typeof upsertPollenForecastBatch;
};

const defaultDependencies: ForecastDependencies = {
  ambeeForecast48h,
  getForecastRows,
  getSupportedCities,
  reserveAmbeeCall,
  resolveCity,
  upsertPollenForecastBatch,
};

type CachedForecast = Awaited<ReturnType<typeof getForecastRows>>;

function cachedForecastResponse(
  city: string,
  cached: CachedForecast,
  {
    stale,
    quotaExhausted,
  }: {
    stale: boolean;
    quotaExhausted?: boolean;
  },
) {
  return publicDataResponse({
    city,
    source: 'cache',
    stale,
    ...(quotaExhausted ? { quotaExhausted: true } : {}),
    fetchedAt: cached.fetchedAt,
    rows: cached.rows.map(withNabRisk),
  });
}

export async function handleForecastRequest(
  req: NextRequest,
  dependencies: ForecastDependencies = defaultDependencies,
) {
  const { searchParams } = new URL(req.url);
  const cityParam = searchParams.get('city');
  if (!cityParam?.trim()) {
    return Response.json({ error: 'Provide ?city=slug' }, { status: 400 });
  }

  try {
    const match = await dependencies.resolveCity(cityParam);
    const city = match.slug;
    const cached = await dependencies.getForecastRows(city);
    const cacheAge = cached.fetchedAt
      ? Date.now() - Date.parse(cached.fetchedAt)
      : Infinity;
    if (cached.rows.length > 0 && cacheAge < CACHE_TTL_MS) {
      return cachedForecastResponse(city, cached, { stale: false });
    }

    try {
      const cities = await dependencies.getSupportedCities();
      const dailyQuota = ambeeDailyQuota();
      const reserve = ambeeForecastReserve(cities.length);
      const jobId = randomUUID();
      const reservation = await dependencies.reserveAmbeeCall({
        job: 'forecast-on-demand',
        jobId,
        dailyQuota,
        reserve,
        notes: { city },
      });
      if (!reservation.reserved) {
        console.warn('[forecast] Ambee daily quota reserve reached; serving stale cache', {
          level: 'warn',
          job: 'forecast',
          city,
          used: reservation.usedBefore,
          quota: dailyQuota,
          reserve,
        });
        if (cached.rows.length > 0) {
          return cachedForecastResponse(city, cached, {
            stale: true,
            quotaExhausted: true,
          });
        }
        return dataErrorResponse(
          'forecast',
          new Error('Ambee daily quota reserve reached without cached rows'),
        );
      }

      // One atomic reservation maps to one provider attempt. Retrying here
      // would undercount quota use and could consume the scheduled ingest reserve.
      const hours = await dependencies.ambeeForecast48h(match.lat, match.lon, {
        retries: 0,
      });
      const rows = hours
        .filter((hour) => hour.ts)
        .map((hour) => toStoredPollenRow(city, hour));
      if (rows.length === 0) {
        throw new Error('Ambee forecast returned no usable rows');
      }

      await dependencies.upsertPollenForecastBatch(rows);

      const fresh = await dependencies.getForecastRows(city);
      if (
        fresh.rows.length === 0 ||
        (cached.fetchedAt && fresh.fetchedAt === cached.fetchedAt)
      ) {
        throw new Error('Ambee forecast refresh did not persist fresh rows');
      }
      return publicDataResponse({
        city,
        source: 'ambee',
        stale: false,
        fetchedAt: fresh.fetchedAt,
        rows: fresh.rows.map(withNabRisk),
      });
    } catch (error) {
      console.error('[forecast] refresh failed', {
        level: 'error',
        job: 'forecast',
        city,
        servingStaleCache: cached.rows.length > 0,
        message: (error as Error)?.message ?? String(error),
      });
      if (cached.rows.length > 0) {
        return cachedForecastResponse(city, cached, { stale: true });
      }
      return dataErrorResponse('forecast', error);
    }
  } catch (error) {
    if (error instanceof UnsupportedCityError) {
      return unsupportedCityResponse(error);
    }
    return dataErrorResponse('forecast', error);
  }
}
