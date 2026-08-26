import { absoluteUrl } from '@/lib/site';

export function GET() {
  const body = `# Pollen Monitor

Pollen Monitor provides public, read-only pollen, species, forecast, weather, and air-quality data for supported US cities.

## Agent entry points

- OpenAPI 3.1 contract: ${absoluteUrl('/openapi.json')}
- Human API documentation: ${absoluteUrl('/docs/api')}
- MCP setup guide: ${absoluteUrl('/docs/mcp')}
- Supported cities: ${absoluteUrl('/api/cities')}
- Latest cross-city pollen GeoJSON: ${absoluteUrl('/api/map-data?date=latest')}

## Recommended workflow

1. Resolve a supported city slug with /api/cities.
2. Use /api/pollen?city={slug} for daily history.
3. Add &date=YYYY-MM-DD for hourly observations on one UTC day.
4. Use /api/forecast?city={slug} for the next 48 hours.
5. Use /api/weather?city={slug}&date=YYYY-MM-DD for matching weather and air quality.

Pollen values are Ambee-modeled concentrations in grains/m³. Risk labels use category-specific National Allergy Bureau thresholds. Species data is available in pollen and forecast rows; Weed is currently Ragweed across the validated dataset.
`;

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
