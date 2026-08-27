import { loadTopCities, type City } from '@/lib/ingest/cities';
import { normalizeCitySlug } from '@/lib/site';

export const UNSUPPORTED_CITY_CODE = 'UNSUPPORTED_CITY';
export const SUPPORTED_CITIES_PATH = '/api/cities';
export const MCP_LIST_CITIES_TOOL = 'list_cities';
export const SUPPORTED_CITY_HINT =
  `Use GET ${SUPPORTED_CITIES_PATH} or the MCP ${MCP_LIST_CITIES_TOOL} tool to choose a supported city.`;

let cityCatalogPromise: Promise<City[]> | null = null;

export class UnsupportedCityError extends Error {
  constructor(readonly city: string) {
    super(`Unsupported city '${city}'. ${SUPPORTED_CITY_HINT}`);
    this.name = 'UnsupportedCityError';
  }
}

export async function getSupportedCities(): Promise<City[]> {
  cityCatalogPromise ??= loadTopCities().catch((error) => {
    cityCatalogPromise = null;
    throw error;
  });
  const cities = await cityCatalogPromise;
  if (cities.length === 0) {
    cityCatalogPromise = null;
    throw new Error('Supported city definitions are unavailable');
  }
  return cities;
}

export async function resolveCity(value: string): Promise<City> {
  const city = normalizeCitySlug(value);
  const match = (await getSupportedCities()).find((candidate) => candidate.slug === city);
  if (!match) {
    throw new UnsupportedCityError(city);
  }
  return match;
}

export async function resolveCities(values: string[]): Promise<City[]> {
  if (values.length === 0) return [];
  const cities = await getSupportedCities();
  const bySlug = new Map(cities.map((city) => [city.slug, city]));
  const resolved = new Map<string, City>();

  for (const value of values) {
    const city = normalizeCitySlug(value);
    const match = bySlug.get(city);
    if (!match) throw new UnsupportedCityError(city);
    resolved.set(city, match);
  }

  return [...resolved.values()];
}

export function unsupportedCityPayload(error: UnsupportedCityError) {
  return {
    error: error.message,
    code: UNSUPPORTED_CITY_CODE,
    city: error.city,
    supportedCities: SUPPORTED_CITIES_PATH,
    mcpTool: MCP_LIST_CITIES_TOOL,
  } as const;
}

export function unsupportedCityResponse(error: UnsupportedCityError) {
  return Response.json(unsupportedCityPayload(error), { status: 404 });
}
