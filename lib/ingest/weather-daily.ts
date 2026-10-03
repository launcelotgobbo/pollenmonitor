import type { City } from '@/lib/ingest/cities';
import {
  OpenWeatherSummaryError,
  openweatherDailyWithAqi,
  utcDatesInWindow,
} from '@/lib/weather/openweather';
import { reserveOpenWeatherCall, upsertWeatherDailyBatch } from '@/lib/db';
import { ingestConcurrency, mapWithConcurrency } from '@/lib/ingest/concurrency';
import { openweatherDailyQuota } from '@/lib/provider-quota';

export type CityWeatherResult = {
  city: string;
  daysFetched: number;
  ok: boolean;
  error?: string;
  stack?: string;
  // Set when AQI was stored but the One Call daily summary was unavailable.
  summaryError?: string;
};
export type WeatherIngestSummary = {
  ok: boolean;
  from: string;
  to: string;
  cities: number;
  wrote: number;
  failed: number;
  summaryFailures: number;
  totalRecordsStored: number;
  ms: number;
  openweatherCalls: number;
};

type WeatherIngestOptions = {
  dryRun?: boolean;
  signal?: AbortSignal;
  onProviderCall?: () => Promise<void>;
};

// Cache only a definitive denial, never an allowance. Every real attempt
// still reserves in Postgres; the denial expires when the UTC quota resets.
export function createWeatherQuota(job: string, jobId: string) {
  const quota = openweatherDailyQuota();
  const utcDay = () => new Date(Date.now()).toISOString().slice(0, 10);
  let exhaustedDay: string | null = null;
  return {
    get exhausted() {
      return exhaustedDay === utcDay();
    },
    async reserve() {
      const day = utcDay();
      if (exhaustedDay === day) throw new Error('OpenWeather daily quota exhausted');
      if (!(await reserveOpenWeatherCall(`${job}-openweather`, jobId, quota))) {
        exhaustedDay = day;
        throw new Error('OpenWeather daily quota exhausted');
      }
    },
  };
}

// Shared by a fixed manual batch and the leased queue. Provider state belongs
// to this invocation, not to each city and not to the server process.
export function createWeatherIngest({
  dryRun = false,
  signal,
  onProviderCall,
}: WeatherIngestOptions = {}) {
  let calls = 0;
  let summaryUnavailable: OpenWeatherSummaryError | null = null;
  return {
    get calls() {
      return calls;
    },
    async ingestCity(city: City, fromISO: string, toISO: string): Promise<CityWeatherResult> {
      try {
        signal?.throwIfAborted();
        const skipSummary = summaryUnavailable !== null;
        const { byDate, summaryError } = await openweatherDailyWithAqi(
          city.lat,
          city.lon,
          fromISO,
          toISO,
          async () => {
            await onProviderCall?.();
            calls++;
          },
          { includeSummary: !skipSummary, signal },
        );
        if (summaryError instanceof OpenWeatherSummaryError && summaryError.affectsAllCities) {
          summaryUnavailable ??= summaryError;
        }
        const rows = Object.entries(byDate).map(([date, weather]) => ({
          ...weather,
          city_slug: city.slug,
          date,
        }));
        if (!dryRun) {
          signal?.throwIfAborted();
          await upsertWeatherDailyBatch(rows);
        }
        const result: CityWeatherResult = { city: city.slug, daysFetched: rows.length, ok: true };
        const summaryMessage = skipSummary
          ? `skipped: ${summaryUnavailable?.message}`
          : (summaryError?.message ??
            (utcDatesInWindow(fromISO, toISO).every(
              (date) => byDate[date]?.temp_max_c != null && byDate[date]?.aqi != null,
            )
              ? undefined
              : 'Incomplete daily weather coverage'));
        if (summaryMessage) {
          result.summaryError = summaryMessage;
        }
        return result;
      } catch (e) {
        const err = e as Error;
        return {
          city: city.slug,
          daysFetched: 0,
          ok: false,
          error: err?.message || String(e),
          stack: err?.stack,
        };
      }
    },
  };
}

export async function ingestWeatherForCities({
  cities,
  fromISO,
  toISO,
  onCityComplete,
  ...options
}: WeatherIngestOptions & {
  cities: City[];
  fromISO: string;
  toISO: string;
  onCityComplete?: (result: CityWeatherResult) => void;
}): Promise<{ summary: WeatherIngestSummary; cityResults: CityWeatherResult[] }> {
  const start = Date.now();
  const ingest = createWeatherIngest(options);
  const cityResults = await mapWithConcurrency(cities, ingestConcurrency(), async (city) => {
    const result = await ingest.ingestCity(city, fromISO, toISO);
    onCityComplete?.(result);
    return result;
  });
  const wrote = cityResults.filter((result) => result.ok).length;
  const failed = cityResults.length - wrote;
  const summaryFailures = cityResults.filter((result) => result.summaryError).length;

  const summary: WeatherIngestSummary = {
    ok: failed === 0 && summaryFailures === 0,
    from: fromISO,
    to: toISO,
    cities: cities.length,
    wrote,
    failed,
    summaryFailures,
    totalRecordsStored: cityResults.reduce((total, result) => total + result.daysFetched, 0),
    ms: Date.now() - start,
    openweatherCalls: ingest.calls,
  };
  return { summary, cityResults };
}
