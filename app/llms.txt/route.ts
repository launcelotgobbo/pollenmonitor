import { absoluteUrl } from '@/lib/site';

export function GET() {
  const body = `# Pollen Monitor

Pollen Monitor provides public, read-only pollen, species, forecast, weather, and air-quality data for supported US cities.

## Agent entry points

- OpenAPI 3.1 contract: ${absoluteUrl('/openapi.json')}
- Interactive Swagger UI: ${absoluteUrl('/docs/api/explorer')}
- Human API documentation: ${absoluteUrl('/docs/api')}
- Hosted MCP server (Streamable HTTP): ${absoluteUrl('/mcp')}
- MCP connection guide: ${absoluteUrl('/docs/mcp')}
- Supported cities: ${absoluteUrl('/api/cities')}
- Latest cross-city pollen GeoJSON: ${absoluteUrl('/api/map-data?date=latest')}

No authentication or API key is required. REST endpoints support cross-origin
browser requests. MCP tools are read-only and publish input and output schemas.

## Tool selection

1. Resolve a supported city slug with /api/cities.
2. Use /api/pollen?city={slug} for up to 720 daily averages.
3. Add &date=YYYY-MM-DD for hourly observations on one UTC calendar day.
4. Use /api/pollen-range for a bounded custom range. The upper bound is exclusive.
5. Use /api/map-data?date=latest for compact comparisons across all cities.
6. Use /api/forecast?city={slug} for the next 48 hours.
7. Use /api/weather?city={slug}&date=YYYY-MM-DD for matching weather and air quality.

Equivalent MCP tools are list_cities, get_pollen, get_pollen_range,
get_forecast, and get_weather. Prefer MCP when the client supports Streamable
HTTP; otherwise call the REST API.

## Worked requests

Daily history:
GET ${absoluteUrl('/api/pollen?city=berkeley')}

Hourly city-day observations:
GET ${absoluteUrl('/api/pollen?city=berkeley&date=2026-08-25')}

Daily rows for an inclusive/exclusive range:
GET ${absoluteUrl('/api/pollen-range?from=2026-08-20&to=2026-08-27&city=berkeley&aggregate=day&limit=500')}

Latest cross-city daily maxima:
GET ${absoluteUrl('/api/map-data?date=latest')}

Forecast:
GET ${absoluteUrl('/api/forecast?city=berkeley')}

Weather and air quality:
GET ${absoluteUrl('/api/weather?city=berkeley&date=2026-08-25')}

## Response conventions

- Successful responses are JSON, except map data uses GeoJSON
  (application/geo+json).
- Pollen fields are tree, grass, weed, and total. Missing pollen measurements
  are null; unavailable optional weather measurements are omitted.
- Daily pollen history and aggregate=day use daily averages.
- Map values use each category's highest hourly reading for the selected day
  and declare aggregation: "daily-category-maxima".
- Dates are UTC YYYY-MM-DD. Timestamps are RFC 3339.
- Pollen values are Ambee-modeled concentrations in grains/m³.
- Risk labels are None, Low, Moderate, High, or Very High and use
  category-specific National Allergy Bureau thresholds.
- Weed is currently Ragweed across the validated dataset.
- Successful public responses may be served from a five-minute shared cache.

## Errors

- Validate status before using a response body.
- Invalid parameters return 400 with {"error":"..."}.
- Unknown city slugs return 404 with code "UNSUPPORTED_CITY" and pointers to
  /api/cities and list_cities.
- Service failures return a sanitized 500 error without internal details.
- For MCP, failures set isError: true; successful object results include
  structuredContent validated against each tool's outputSchema.

For complete schemas and full success/error examples, use the OpenAPI contract.
`;

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
