import { loadTopCities } from '@/lib/ingest/cities';

export const SUPPORTED_CITY_HINT =
  'Use GET /api/cities or the MCP list_cities tool to choose a supported city.';

export class UnsupportedCityError extends Error {
  constructor(readonly city: string) {
    super(`Unsupported city '${city}'. ${SUPPORTED_CITY_HINT}`);
    this.name = 'UnsupportedCityError';
  }
}

export async function assertSupportedCity(city: string) {
  const cities = await loadTopCities();
  if (cities.length === 0) {
    throw new Error('Supported city definitions are unavailable');
  }
  if (!cities.some((candidate) => candidate.slug === city)) {
    throw new UnsupportedCityError(city);
  }
}
