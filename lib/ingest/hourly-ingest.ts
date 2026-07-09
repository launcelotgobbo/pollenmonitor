import { ambeeHourlyRange } from './ambee';
import { upsertPollenHourlyBatch } from '@/lib/db';
import { ingestConcurrency, mapWithConcurrency } from './concurrency';
import type { City } from './cities';

export type CityIngestResult = {
  city: string;
  hoursFetched: number;
  ok: boolean;
  error?: string;
  stack?: string;
};

export type HourlyIngestSummary = {
  ok: boolean;
  from: string;
  to: string;
  cities: number;
  wrote: number;
  failed: number;
  totalRecordsStored: number;
  ms: number;
  ambeeCalls: number;
};

export async function ingestHourlyForCities({
  cities,
  fromISO,
  toISO,
  dryRun = false,
  onCityComplete,
}: {
  cities: City[];
  fromISO: string;
  toISO: string;
  dryRun?: boolean;
  onCityComplete?: (result: CityIngestResult) => void;
}): Promise<{ summary: HourlyIngestSummary; cityResults: CityIngestResult[] }> {
  const start = Date.now();
  let wrote = 0;
  let failed = 0;
  let totalRecordsStored = 0;
  let ambeeCalls = 0;

  const cityResults = await mapWithConcurrency(cities, ingestConcurrency(), async (city) => {
    try {
      ambeeCalls += 1;
      const hours = await ambeeHourlyRange(city.lat, city.lon, fromISO, toISO);
      if (!dryRun) {
        await upsertPollenHourlyBatch(
          hours.map((h) => ({
            city_slug: city.slug,
            ts: h.ts,
            tz: h.tz ?? null,
            grass: h.grass ?? null,
            tree: h.tree ?? null,
            weed: h.weed ?? null,
            total: (h.grass ?? 0) + (h.tree ?? 0) + (h.weed ?? 0),
            risk_grass: h.risk_grass ?? null,
            risk_tree: h.risk_tree ?? null,
            risk_weed: h.risk_weed ?? null,
            species: h.species ?? null,
          })),
        );
      }
      wrote++;
      totalRecordsStored += hours.length;
      const result: CityIngestResult = { city: city.slug, hoursFetched: hours.length, ok: true };
      onCityComplete?.(result);
      return result;
    } catch (e) {
      failed++;
      const err = e as Error;
      const error = err?.message || String(e);
      const stack = err?.stack;
      const result: CityIngestResult = { city: city.slug, hoursFetched: 0, ok: false, error, stack };
      onCityComplete?.(result);
      return result;
    }
  });

  const summary: HourlyIngestSummary = {
    ok: failed === 0,
    from: fromISO,
    to: toISO,
    cities: cities.length,
    wrote,
    failed,
    totalRecordsStored,
    ms: Date.now() - start,
    ambeeCalls,
  };

  return { summary, cityResults };
}
