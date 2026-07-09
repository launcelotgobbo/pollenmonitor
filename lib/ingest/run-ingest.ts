import { logIngest, logProviderUsage } from '@/lib/db';
import type { City } from '@/lib/ingest/cities';
import { ingestHourlyForCities } from '@/lib/ingest/hourly-ingest';
import { ingestWeatherForCities, type WeatherIngestSummary, type CityWeatherResult } from '@/lib/ingest/weather-daily';

export type IngestJobOptions = {
  job: string;
  logLabel: string;
  jobId: string;
  cities: City[];
  fromISO: string;
  toISO: string;
  dryRun?: boolean;
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
  includeWeather = true,
}: IngestJobOptions): Promise<{ result: Record<string, any>; httpStatus: number }> {
  const ambeeQuota = Number(process.env.AMBEE_DAILY_QUOTA ?? '200');
  const openweatherQuota = Number(process.env.OPENWEATHER_DAILY_QUOTA ?? '1000');

  const { summary, cityResults } = await ingestHourlyForCities({
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
  });

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
  }

  const weatherOk = weatherSummary?.ok ?? true;
  const weatherAllFailed = !includeWeather || (weatherSummary ? weatherSummary.failed === cities.length : true);
  const status =
    summary.ok && weatherOk
      ? 'success'
      : summary.failed === cities.length && weatherAllFailed
        ? 'failure'
        : 'partial';

  const result = {
    jobId,
    dryRun,
    ...summary,
    totalDaysStored: summary.totalRecordsStored,
    cityResults,
    weather: weatherSummary ? { summary: weatherSummary, cityResults: weatherResults } : null,
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

  await logIngest(status, result);

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

  const httpStatus = summary.ok ? 200 : summary.failed === cities.length ? 500 : 207;
  return { result, httpStatus };
}
