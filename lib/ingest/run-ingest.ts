import { logIngest, logProviderUsage } from '@/lib/db';
import type { City } from '@/lib/ingest/cities';
import {
  ingestHourlyForCities,
  type CityIngestResult,
  type HourlyIngestSummary,
} from '@/lib/ingest/hourly-ingest';
import { ingestWeatherForCities, type WeatherIngestSummary, type CityWeatherResult } from '@/lib/ingest/weather-daily';
import { refreshPollenDaily } from '@/lib/pollen-daily';
import { ambeeDailyQuota, openweatherDailyQuota } from '@/lib/provider-quota';

export type PollenDailyRefreshResult = {
  ok: boolean;
  from?: string;
  to?: string;
  rows: number;
  ms: number;
  error?: string;
};

export type IngestJobOptions = {
  job: string;
  logLabel: string;
  jobId: string;
  cities: City[];
  fromISO: string;
  toISO: string;
  dryRun?: boolean;
  includePollen?: boolean;
  includeWeather?: boolean;
};

export async function runIngestJob({
  job,
  logLabel,
  jobId,
  cities,
  fromISO,
  toISO,
  dryRun = false,
  includePollen = true,
  includeWeather = true,
}: IngestJobOptions): Promise<{ result: Record<string, any>; httpStatus: number }> {
  if (!includePollen && !includeWeather) {
    throw new Error('runIngestJob needs at least one of includePollen or includeWeather');
  }
  const ambeeQuota = ambeeDailyQuota();
  const openweatherQuota = openweatherDailyQuota();

  // A weather-only run reports an empty pollen pass so the result keeps one
  // shape for every caller that reads ingest_logs.
  let summary: HourlyIngestSummary = {
    ok: true,
    from: fromISO,
    to: toISO,
    cities: cities.length,
    wrote: 0,
    failed: 0,
    totalRecordsStored: 0,
    ms: 0,
    ambeeCalls: 0,
  };
  let cityResults: CityIngestResult[] = [];
  if (includePollen) {
    ({ summary, cityResults } = await ingestHourlyForCities({
      cities,
      fromISO,
      toISO,
      dryRun,
      onCityComplete: (outcome) => {
        if (outcome.ok) {
          console.log(`${logLabel} city success`, {
            level: 'info',
            job,
            jobId,
            city: outcome.city,
            hoursFetched: outcome.hoursFetched,
          });
        } else {
          console.error(`${logLabel} city failure`, {
            level: 'error',
            job,
            jobId,
            city: outcome.city,
            message: outcome.error,
            stack: outcome.stack,
          });
        }
      },
    }));
  }

  // Daily readers serve pollen_daily, so the days this run wrote must be
  // recomputed before the run can count as a success.
  let pollenDaily: PollenDailyRefreshResult | null = null;
  if (!dryRun && summary.wrote > 0) {
    const started = Date.now();
    try {
      const refreshed = await refreshPollenDaily({
        from: fromISO,
        to: toISO,
        cities: cities.map((c) => c.slug),
      });
      pollenDaily = { ok: true, ...refreshed, ms: Date.now() - started };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pollenDaily = { ok: false, rows: 0, ms: Date.now() - started, error: message };
      console.error(`${logLabel} daily summary refresh failed`, {
        level: 'error',
        job,
        jobId,
        message,
      });
    }
  }

  let weatherSummary: WeatherIngestSummary | null = null;
  let weatherResults: CityWeatherResult[] = [];
  if (includeWeather) {
    const weather = await ingestWeatherForCities({
      cities,
      fromISO,
      toISO,
      dryRun,
      onCityComplete: (outcome) => {
        if (outcome.ok) {
          console.log(`${logLabel} weather success`, {
            level: 'info',
            job,
            jobId,
            city: outcome.city,
            daysFetched: outcome.daysFetched,
            ...(outcome.summaryError ? { summaryError: outcome.summaryError } : {}),
          });
        } else {
          console.error(`${logLabel} weather failure`, {
            level: 'error',
            job,
            jobId,
            city: outcome.city,
            message: outcome.error,
            stack: outcome.stack,
          });
        }
      },
    });
    weatherSummary = weather.summary;
    weatherResults = weather.cityResults;
    if (weatherSummary.summaryFailures > 0) {
      console.warn(`${logLabel} weather daily summary unavailable`, {
        level: 'warn',
        job,
        jobId,
        summaryFailures: weatherSummary.summaryFailures,
        cities: cities.length,
        firstError: weatherResults.find((r) => r.summaryError)?.summaryError,
      });
    }
  }

  const weatherOk = weatherSummary?.ok ?? true;
  const pollenDailyOk = pollenDaily?.ok ?? true;
  const pollenAllFailed = !includePollen || summary.failed === cities.length;
  const weatherAllFailed = !includeWeather || (weatherSummary ? weatherSummary.failed === cities.length : true);
  const status =
    summary.ok && weatherOk && pollenDailyOk
      ? 'success'
      : pollenAllFailed && weatherAllFailed
        ? 'failure'
        : 'partial';

  const result = {
    jobId,
    dryRun,
    includePollen,
    includeWeather,
    ...summary,
    // `ok` has always tracked the pollen pass; without one it tracks weather.
    ok: includePollen ? summary.ok : weatherOk,
    totalDaysStored: summary.totalRecordsStored,
    // Stacks stay in the per-city console logs above; persisting them would put
    // server file paths into ingest_logs rows.
    cityResults: cityResults.map(({ stack, ...rest }) => rest),
    pollenDaily,
    weather: weatherSummary
      ? { summary: weatherSummary, cityResults: weatherResults.map(({ stack, ...rest }) => rest) }
      : null,
    status,
  };

  console.log(`${logLabel} completed`, {
    level: 'info',
    job,
    ts: new Date().toISOString(),
    ...result,
    status,
  });

  if (result.ambeeCalls > ambeeQuota) {
    console.warn(`${logLabel} ambee call quota exceeded`, {
      level: 'warn',
      job,
      jobId,
      ambeeCalls: result.ambeeCalls,
      quota: ambeeQuota,
    });
  }
  const openweatherCalls = weatherSummary?.openweatherCalls ?? 0;
  if (openweatherCalls > openweatherQuota) {
    console.warn(`${logLabel} openweather call quota exceeded`, {
      level: 'warn',
      job,
      jobId,
      openweatherCalls,
      quota: openweatherQuota,
    });
  }

  await logIngest(job, status, result);

  const usageNotes = {
    window: { from: fromISO, to: toISO },
    cities: cities.map((c) => c.slug),
    status,
    dryRun,
  };
  if (result.ambeeCalls > 0) {
    await logProviderUsage(job, jobId, result.ambeeCalls, usageNotes);
  }
  if (openweatherCalls > 0) {
    await logProviderUsage(`${job}-openweather`, jobId, openweatherCalls, {
      ...usageNotes,
      status: weatherSummary?.ok ? 'success' : 'partial',
    });
  }

  // With pollen in the run the HTTP status follows the pollen pass, as before;
  // a weather-only run has nothing else to report on.
  const httpStatus = includePollen
    ? summary.ok && pollenDailyOk ? 200 : summary.failed === cities.length ? 500 : 207
    : weatherOk ? 200 : weatherAllFailed ? 500 : 207;
  return { result, httpStatus };
}
