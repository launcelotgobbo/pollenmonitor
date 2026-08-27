import { strict as assert } from 'node:assert';
import test from 'node:test';
import { API_EXAMPLES } from '@/lib/api-examples';
import {
  callMcpCityApi,
  citiesOutputSchema,
  forecastInputSchema,
  forecastOutputSchema,
  getCachedMcpForecast,
  pollenInputSchema,
  pollenOutputSchema,
  pollenRangeInputSchema,
  pollenRangeOutputSchema,
  weatherInputSchema,
  weatherOutputSchema,
} from '@/lib/mcp';

const unsupportedCityMessage =
  "Unsupported city 'atlantis'. Use GET /api/cities or the MCP list_cities tool to choose a supported city.";

test('MCP tool schemas accept bounded read-only inputs', () => {
  assert.deepEqual(pollenInputSchema.parse({ city: 'seattle', date: '2026-08-26' }), {
    city: 'seattle',
    date: '2026-08-26',
  });
  assert.deepEqual(
    pollenRangeInputSchema.parse({ from: '2026-08-01', to: '2026-08-02' }),
    {
      from: '2026-08-01',
      to: '2026-08-02',
      aggregate: 'day',
      limit: 500,
    },
  );
  assert.deepEqual(forecastInputSchema.parse({ city: 'denver' }), { city: 'denver' });
  assert.deepEqual(weatherInputSchema.parse({ city: 'portland' }), { city: 'portland' });
});

test('MCP tool schemas reject invalid dates, slugs, and excessive limits', () => {
  assert.equal(pollenInputSchema.safeParse({ city: '../seattle' }).success, false);
  assert.equal(pollenInputSchema.safeParse({ city: 'seattle', date: '2026-02-31' }).success, false);
  assert.equal(
    pollenRangeInputSchema.safeParse({
      from: '2026-08-01',
      to: '2026-08-02',
      limit: 2001,
    }).success,
    false,
  );
});

test('MCP output schemas describe every successful structured response', () => {
  assert.equal(citiesOutputSchema.safeParse(API_EXAMPLES.cities).success, true);
  assert.equal(pollenOutputSchema.safeParse(API_EXAMPLES.hourlyPollen).success, true);
  assert.equal(pollenOutputSchema.safeParse(API_EXAMPLES.dailyPollen).success, true);
  assert.equal(pollenOutputSchema.safeParse(API_EXAMPLES.crossCityPollen).success, true);
  assert.equal(pollenRangeOutputSchema.safeParse(API_EXAMPLES.pollenRange).success, true);
  assert.equal(forecastOutputSchema.safeParse(API_EXAMPLES.mcpForecast).success, true);
  assert.equal(weatherOutputSchema.safeParse(API_EXAMPLES.weather).success, true);
});

test('MCP city API tools use the shared unsupported-city resolver', async () => {
  for (const [path, parameters] of [
    ['/api/pollen', {}],
    ['/api/pollen-range', { from: '2026-08-01', to: '2026-08-02' }],
    ['/api/weather', {}],
  ] as const) {
    const result = await callMcpCityApi(path, 'atlantis', parameters);
    assert.equal('isError' in result && result.isError, true);
    assert.equal(result.content[0].text, unsupportedCityMessage);
  }
});

test('MCP forecast uses the shared unsupported-city resolver', async () => {
  const result = await getCachedMcpForecast('atlantis');

  assert.equal('isError' in result && result.isError, true);
  assert.equal(result.content[0].text, unsupportedCityMessage);
});
