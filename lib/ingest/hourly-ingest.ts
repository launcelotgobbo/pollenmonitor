import { ambeeHourlyRange } from './ambee';
import { upsertPollenHourly } from '@/lib/db';
import type { City } from './cities';

export type CityIngestResult = {
  city: string;
  hoursFetched: number;
  ok: boolean;
  error?: string;
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
  const cityResults: CityIngestResult[] = [];
  let wrote = 0;
  let failed = 0;
  let totalRecordsStored = 0;

  for (const city of cities) {
    try {
      const hours = await ambeeHourlyRange(city.lat, city.lon, fromISO, toISO);
      if (!dryRun) {
        for (const h of hours) {
          await upsertPollenHourly({
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
          });
        }
      }
      wrote++;
      totalRecordsStored += hours.length;
      const result: CityIngestResult = { city: city.slug, hoursFetched: hours.length, ok: true };
      cityResults.push(result);
      onCityComplete?.(result);
    } catch (e) {
      failed++;
      const error = (e as Error)?.message || String(e);
      const result: CityIngestResult = { city: city.slug, hoursFetched: 0, ok: false, error };
      cityResults.push(result);
      onCityComplete?.(result);
    }
  }

  const summary: HourlyIngestSummary = {
    ok: failed === 0,
    from: fromISO,
    to: toISO,
    cities: cities.length,
    wrote,
    failed,
    totalRecordsStored,
    ms: Date.now() - start,
  };

  return { summary, cityResults };
}
