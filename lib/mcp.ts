import { z } from 'zod';
import { resolveCity, UnsupportedCityError } from '@/lib/cities';
import { getForecastRows } from '@/lib/db';
import { POLLEN_RANGE_AGGREGATES } from '@/lib/pollenRange';
import { POLLEN_RISK_LABELS, withNabRisk } from '@/lib/risk';
import { absoluteUrl, normalizeCitySlug } from '@/lib/site';

const citySchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9-]+$/i, 'Use a city slug from list_cities')
  .transform(normalizeCitySlug);
const dateSchema = z.iso.date({ error: 'Use a valid date in YYYY-MM-DD format' });

export const pollenInputSchema = z.object({
  city: citySchema.describe('Supported city slug, such as seattle or denver'),
  date: dateSchema.optional().describe('Optional UTC date for hourly readings'),
});

export const pollenRangeInputSchema = z.object({
  from: dateSchema.describe('Inclusive start date in YYYY-MM-DD format'),
  to: dateSchema.describe('Exclusive end date in YYYY-MM-DD format'),
  city: citySchema.optional().describe('Optional supported city slug'),
  aggregate: z.enum(POLLEN_RANGE_AGGREGATES).default('day'),
  limit: z.number().int().min(1).max(2000).default(500),
});

export const forecastInputSchema = z.object({
  city: citySchema.describe('Supported city slug, such as seattle or denver'),
});

export const weatherInputSchema = z.object({
  city: citySchema.describe('Supported city slug, such as seattle or denver'),
  date: dateSchema.optional().describe('Optional date in YYYY-MM-DD format'),
});

const nullableNumberSchema = z.number().nullable();
const nullableStringSchema = z.string().nullable();
const riskSchema = z
  .enum(POLLEN_RISK_LABELS)
  .nullable()
  .describe('NAB category-specific risk label');
const speciesSchema = z
  .record(
    z.string(),
    z.union([z.record(z.string(), z.number()), z.number()]),
  )
  .nullable()
  .describe('Pollen category names mapped to allergen concentrations in grains/m³');

const hourlyPollenSchema = z.object({
  ts: z.iso.datetime(),
  tree: nullableNumberSchema,
  grass: nullableNumberSchema,
  weed: nullableNumberSchema,
  total: z.number(),
  species: speciesSchema,
  risk_tree: riskSchema,
  risk_grass: riskSchema,
  risk_weed: riskSchema,
  timezone: nullableStringSchema.optional(),
});

const dailyPollenSchema = z.object({
  date: dateSchema,
  tree: nullableNumberSchema,
  grass: nullableNumberSchema,
  weed: nullableNumberSchema,
  total: nullableNumberSchema,
  species: speciesSchema,
  risk_tree: riskSchema,
  risk_grass: riskSchema,
  risk_weed: riskSchema,
  timezone: nullableStringSchema,
});

const forecastPollenSchema = z.object({
  ts: z.iso.datetime(),
  tree: nullableNumberSchema,
  grass: nullableNumberSchema,
  weed: nullableNumberSchema,
  total: nullableNumberSchema,
  species: speciesSchema,
  risk_tree: riskSchema,
  risk_grass: riskSchema,
  risk_weed: riskSchema,
  tz: nullableStringSchema,
});

export const citiesOutputSchema = z.object({
  cities: z.array(
    z.object({
      name: z.string(),
      slug: z.string(),
    }),
  ),
});

export const pollenOutputSchema = z.union([
  z.object({
    city: z.string(),
    date: dateSchema,
    rows: z.array(hourlyPollenSchema),
  }),
  z.object({
    city: z.string(),
    rows: z.array(dailyPollenSchema),
  }),
  z.object({
    date: dateSchema,
    rows: z.array(
      z.object({
        city: z.string(),
        date: dateSchema,
        count: z.number(),
        source: z.literal('ambee'),
        is_forecast: z.literal(false),
        max_weed: z.number(),
      }),
    ),
  }),
]);

export const pollenRangeOutputSchema = z.object({
  from: z.iso.datetime(),
  to: z.iso.datetime(),
  cities: z.array(z.string()),
  aggregate: z.enum(POLLEN_RANGE_AGGREGATES),
  rows: z.array(
    z.object({
      city: z.string(),
      periodStart: z.iso.datetime(),
      tree: nullableNumberSchema,
      grass: nullableNumberSchema,
      weed: nullableNumberSchema,
      total: nullableNumberSchema,
      timezone: nullableStringSchema,
      species: speciesSchema,
      risk_tree: riskSchema,
      risk_grass: riskSchema,
      risk_weed: riskSchema,
    }),
  ),
});

export const forecastOutputSchema = z.object({
  city: z.string(),
  source: z.literal('cache'),
  fetchedAt: z.iso.datetime().nullable(),
  rows: z.array(forecastPollenSchema),
});

const optionalWeatherMeasurements = {
  tz: z.string().optional(),
  timezone: z.string().optional(),
  temp_min_c: z.number().optional(),
  temp_max_c: z.number().optional(),
  temp_day_c: z.number().optional(),
  feels_like_day_c: z.number().optional(),
  humidity: z.number().int().optional(),
  pressure_hpa: z.number().int().optional(),
  wind_speed_ms: z.number().optional(),
  wind_deg: z.number().int().optional(),
  clouds_pct: z.number().int().optional(),
  precip_mm: z.number().optional(),
  uvi: z.number().optional(),
  weather_main: z.string().optional(),
  weather_desc: z.string().optional(),
  aqi: z.number().int().min(1).max(5).optional(),
  aqi_pm2_5: z.number().optional(),
  aqi_pm10: z.number().optional(),
  aqi_o3: z.number().optional(),
  aqi_no2: z.number().optional(),
  aqi_so2: z.number().optional(),
  aqi_co: z.number().optional(),
  source: z.string().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
};

export const weatherOutputSchema = z.object({
  city: z.string().optional(),
  date: dateSchema.optional(),
  rows: z.array(
    z.object({
      city_slug: z.string(),
      date: dateSchema,
      ...optionalWeatherMeasurements,
    }),
  ),
});

type ApiParameters = Record<string, string | number | undefined>;

function mcpJsonResult(body: unknown) {
  const text = JSON.stringify(body);
  return {
    content: [{ type: 'text' as const, text }],
    ...(body && typeof body === 'object' && !Array.isArray(body)
      ? { structuredContent: body as Record<string, unknown> }
      : {}),
  };
}

function mcpErrorResult(message: string) {
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: message }],
  };
}

export async function callMcpApi(path: string, parameters: ApiParameters = {}) {
  const url = new URL(absoluteUrl(path));
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        body && typeof body === 'object' && 'error' in body
          ? String(body.error)
          : `Pollen API request failed with status ${response.status}`;
      return mcpErrorResult(message);
    }

    return mcpJsonResult(body);
  } catch {
    return mcpErrorResult('Pollen API request unavailable');
  }
}

export async function callMcpCityApi(
  path: string,
  city: string,
  parameters: ApiParameters = {},
) {
  try {
    const resolved = await resolveCity(city);
    return callMcpApi(path, { ...parameters, city: resolved.slug });
  } catch (error) {
    if (error instanceof UnsupportedCityError) {
      return mcpErrorResult(error.message);
    }
    return mcpErrorResult('Supported city definitions are unavailable');
  }
}

export async function getCachedMcpForecast(city: string) {
  try {
    const resolved = await resolveCity(city);
    const cached = await getForecastRows(resolved.slug);
    return mcpJsonResult({
      city: resolved.slug,
      source: 'cache',
      fetchedAt: cached.fetchedAt,
      rows: cached.rows.map(withNabRisk),
    });
  } catch (error) {
    if (error instanceof UnsupportedCityError) {
      return mcpErrorResult(error.message);
    }
    return mcpErrorResult('Forecast data unavailable');
  }
}
