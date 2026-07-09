import type { City } from '@/lib/ingest/cities';
import { openweatherDailyWithAqi } from '@/lib/weather/openweather';
import { upsertWeatherDaily } from '@/lib/db';
import { ingestConcurrency, mapWithConcurrency } from '@/lib/ingest/concurrency';

export type CityWeatherResult = { city: string; daysFetched: number; ok: boolean; error?: string; stack?: string };
export type WeatherIngestSummary = { ok: boolean; from: string; to: string; cities: number; wrote: number; failed: number; totalRecordsStored: number; ms: number; openweatherCalls: number };

export async function ingestWeatherForCities({ cities, fromISO, toISO, dryRun = false, onCityComplete, }: { cities: City[]; fromISO: string; toISO: string; dryRun?: boolean; onCityComplete?: (r: CityWeatherResult) => void; }): Promise<{ summary: WeatherIngestSummary; cityResults: CityWeatherResult[] }> {
  const start = Date.now();
  let wrote = 0;
  let failed = 0;
  let totalRecordsStored = 0;
  let openweatherCalls = 0;

  const cityResults = await mapWithConcurrency(cities, ingestConcurrency(), async (city) => {
    try {
      openweatherCalls += 2; // OneCall + Air History
      const byDate = await openweatherDailyWithAqi(city.lat, city.lon, fromISO, toISO);
      const dates = Object.keys(byDate);
      if (!dryRun) {
        for (const d of dates) {
          const w = byDate[d];
          await upsertWeatherDaily({
            city_slug: city.slug,
            date: d,
            tz: w.tz ?? null,
            temp_min_c: w.temp_min_c ?? null,
            temp_max_c: w.temp_max_c ?? null,
            temp_day_c: w.temp_day_c ?? null,
            feels_like_day_c: w.feels_like_day_c ?? null,
            humidity: w.humidity ?? null,
            pressure_hpa: w.pressure_hpa ?? null,
            wind_speed_ms: w.wind_speed_ms ?? null,
            wind_deg: w.wind_deg ?? null,
            clouds_pct: w.clouds_pct ?? null,
            precip_mm: w.precip_mm ?? null,
            uvi: w.uvi ?? null,
            weather_main: w.weather_main ?? null,
            weather_desc: w.weather_desc ?? null,
            aqi: w.aqi ?? null,
            aqi_pm2_5: w.aqi_pm2_5 ?? null,
            aqi_pm10: w.aqi_pm10 ?? null,
            aqi_o3: w.aqi_o3 ?? null,
            aqi_no2: w.aqi_no2 ?? null,
            aqi_so2: w.aqi_so2 ?? null,
            aqi_co: w.aqi_co ?? null,
          });
        }
      }
      wrote++;
      totalRecordsStored += dates.length;
      const result: CityWeatherResult = { city: city.slug, daysFetched: dates.length, ok: true };
      onCityComplete?.(result);
      return result;
    } catch (e) {
      failed++;
      const err = e as Error;
      const result: CityWeatherResult = { city: city.slug, daysFetched: 0, ok: false, error: err?.message || String(e), stack: err?.stack };
      onCityComplete?.(result);
      return result;
    }
  });

  const summary: WeatherIngestSummary = {
    ok: failed === 0,
    from: fromISO,
    to: toISO,
    cities: cities.length,
    wrote,
    failed,
    totalRecordsStored,
    ms: Date.now() - start,
    openweatherCalls,
  };
  return { summary, cityResults };
}

