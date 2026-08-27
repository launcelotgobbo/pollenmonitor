import { z } from 'zod';
import { resolveCity, UnsupportedCityError } from '@/lib/cities';
import { getForecastRows } from '@/lib/db';
import { withNabRisk } from '@/lib/risk';
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
  aggregate: z.enum(['none', 'day']).default('day'),
  limit: z.number().int().min(1).max(2000).default(500),
});

export const forecastInputSchema = z.object({
  city: citySchema.describe('Supported city slug, such as seattle or denver'),
});

export const weatherInputSchema = z.object({
  city: citySchema.describe('Supported city slug, such as seattle or denver'),
  date: dateSchema.optional().describe('Optional date in YYYY-MM-DD format'),
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
