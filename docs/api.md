# Pollen Monitor API

Version 2.1.0 exposes public, read-only endpoints for pollen, species, forecasts, map data, weather, and air quality. All endpoints return JSON and live under the same origin as the app (for example `${NEXT_PUBLIC_BASE_URL}`, which defaults to `https://pollenmonitor.dev`). For MCP integration notes see [mcp-server.md](./mcp-server.md), and see [`CHANGELOG.md`](../CHANGELOG.md) for breaking changes.

The endpoints do not require authentication and send `Access-Control-Allow-Origin: *`
so browser applications can read them cross-origin. Successful public data
responses use a five-minute shared edge cache with stale-while-revalidate;
immutable historical map windows and discovery endpoints may be cached longer.

Machine-readable and agent-oriented discovery:

- OpenAPI 3.1: [`/openapi.json`](/openapi.json)
- Well-known OpenAPI redirect: [`/.well-known/openapi.json`](/.well-known/openapi.json)
- Agent guide: [`/llms.txt`](/llms.txt)

## Units and risk methodology

Pollen values are modeled Ambee concentrations in grains/m³. Category risk labels are calculated by Pollen Monitor using the [National Allergy Bureau (NAB) ranges](https://www.aaaai.org/global/nab-pollen-counts/reading-the-charts):

| Category | Low | Moderate | High | Very High |
|----------|-----|----------|------|-----------|
| Weed/Ragweed | 1–9 | 10–49 | 50–499 | 500+ |
| Grass | 1–4 | 5–19 | 20–199 | 200+ |
| Tree | 1–14 | 15–89 | 90–1499 | 1500+ |

Zero is reported as `None`. When a category contains multiple species, its risk is based on the highest individual species value rather than the category sum because the NAB ranges apply per allergen.

## `GET /api/cities`

Alphabetised list of supported cities.

```http
GET ${NEXT_PUBLIC_BASE_URL}/api/cities
```

## `GET /api/available-dates`

Returns UTC dates with pollen observations, newest first.

```http
GET ${NEXT_PUBLIC_BASE_URL}/api/available-dates
```

```json
{ "dates": ["2026-08-26", "2026-08-25"] }
```

## `GET /api/latest-date`

Returns the latest UTC pollen observation date.

```http
GET ${NEXT_PUBLIC_BASE_URL}/api/latest-date
```

```json
{ "date": "2026-08-26" }
```

```json
{
  "cities": [
    { "name": "Atlanta", "slug": "atlanta" },
    { "name": "Austin", "slug": "austin" }
  ]
}
```

## `GET /api/pollen`

### Hourly readings

Provide both `city` and `date` (`YYYY-MM-DD`) to fetch hourly readings for that UTC day.

```http
GET ${NEXT_PUBLIC_BASE_URL}/api/pollen?city=san-francisco&date=2024-04-14
```

```json
{
  "city": "san-francisco",
  "date": "2024-04-14",
  "rows": [
    {
      "ts": "2024-04-14T00:00:00.000Z",
      "tree": 12,
      "grass": 4,
      "weed": 0,
      "total": 16,
      "species": {
        "Tree": { "Oak": 8, "Pine": 4 },
        "Grass": { "Grass": 4 },
        "Weed": { "Ragweed": 0 }
      },
      "risk_tree": "Low",
      "risk_grass": "Low",
      "risk_weed": "None",
      "timezone": "America/Los_Angeles"
    }
  ]
}
```

### Daily averages

Provide only `city` to receive up to the last 720 days of rounded daily averages.

```http
GET ${NEXT_PUBLIC_BASE_URL}/api/pollen?city=san-francisco
```

```json
{
  "city": "san-francisco",
  "rows": [
    {
      "date": "2024-04-14",
      "tree": 19,
      "grass": 7,
      "weed": 2,
      "total": 28,
      "species": {
        "Tree": { "Oak": 12, "Pine": 7 },
        "Grass": { "Grass": 7 },
        "Weed": { "Ragweed": 2 }
      },
      "risk_tree": "Low",
      "risk_grass": "Moderate",
      "risk_weed": "Low",
      "timezone": "America/Los_Angeles"
    }
  ]
}
```

All city-aware endpoints return the same structured `404` response for unsupported city slugs:

```json
{
  "error": "Unsupported city 'atlantis'. Use GET /api/cities or the MCP list_cities tool to choose a supported city.",
  "code": "UNSUPPORTED_CITY",
  "city": "atlantis",
  "supportedCities": "/api/cities",
  "mcpTool": "list_cities"
}
```

## `GET /api/pollen-range`

Query data over arbitrary date windows. Supports hourly data (`aggregate=none`, the default) or per-day averages (`aggregate=day`). Both modes return the same flat row shape. Optional `city` accepts a comma-separated list; omit it for all cities.

| Parameter   | Required | Description                                     |
|-------------|----------|-------------------------------------------------|
| `from`      | ✅        | Start (inclusive). Accepts `YYYY-MM-DD` or RFC 3339. |
| `to`        | ✅        | End (exclusive). Must be after `from`.         |
| `city`      | ❌        | Comma-separated city slugs.                     |
| `aggregate` | ❌        | `none` or `day`; other values return `400`.     |
| `limit`     | ❌        | Integer row cap (1–50 000, default 20 000); invalid values return `400`. |

### Hourly example

```http
GET /api/pollen-range?city=denver&from=2024-04-10&to=2024-04-15
```

```json
{
  "from": "2024-04-10T00:00:00.000Z",
  "to": "2024-04-15T00:00:00.000Z",
  "cities": ["denver"],
  "aggregate": "none",
  "rows": [
    {
      "city": "denver",
      "periodStart": "2024-04-10T06:00:00.000Z",
      "tree": 32,
      "grass": 5,
      "weed": 0,
      "risk_tree": "Moderate",
      "risk_grass": "Moderate",
      "risk_weed": "None",
      "total": 37,
      "timezone": "America/Denver"
    }
  ]
}
```

### Daily example

```http
GET /api/pollen-range?aggregate=day&city=denver,san-francisco&from=2024-04-01&to=2024-04-15
```

```json
{
  "from": "2024-04-01T00:00:00.000Z",
  "to": "2024-04-15T00:00:00.000Z",
  "cities": ["denver", "san-francisco"],
  "aggregate": "day",
  "rows": [
    {
      "city": "denver",
      "periodStart": "2024-04-01T00:00:00.000Z",
      "tree": 24,
      "grass": 3,
      "weed": 0,
      "total": 27,
      "timezone": "America/Denver"
    }
  ]
}
```

Errors return a `400` with an explanatory message, for example:

```json
{ "error": "Parameter 'from' must be before 'to'" }
```

Unknown aggregation modes are also rejected rather than silently treated as
hourly:

```json
{ "error": "Invalid parameter 'aggregate': expected 'none' or 'day'" }
```

## `GET /api/map-data`

Returns compact cross-city GeoJSON for a UTC date. Use `date=latest`, omit `date`, or provide `YYYY-MM-DD`. Each category uses its maximum hourly reading for the day; `count` is the sum of those category maxima. The response declares `aggregation: "daily-category-maxima"` plus `value_basis: "daily-category-maxima"` on each feature. Each city feature contains category values, NAB risks, a headline `ragweed` and `risk_ragweed` slice, coordinates, timezone, and a three-day series. Full species blobs are intentionally omitted from this endpoint.

```http
GET ${NEXT_PUBLIC_BASE_URL}/api/map-data?date=latest
```

```json
{
  "type": "FeatureCollection",
  "date": "2026-08-26",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "city": "berkeley",
        "tree": 24,
        "grass": 4,
        "weed": 34,
        "ragweed": 34,
        "risk_tree": "Moderate",
        "risk_grass": "Low",
        "risk_weed": "Moderate",
        "risk_ragweed": "Moderate",
        "series": []
      },
      "geometry": {
        "type": "Point",
        "coordinates": [-122.27, 37.87]
      }
    }
  ]
}
```

## `GET /api/weather`

Daily weather and air-quality observations (OpenWeather) collected alongside pollen data. Fields unavailable from the provider are omitted instead of being returned as `null`.

| Parameter | Required | Description                                           |
|-----------|----------|-------------------------------------------------------|
| `city`    | ❌*       | City slug. Alone: up to 365 days, newest first.       |
| `date`    | ❌*       | `YYYY-MM-DD`. Alone: cross-city snapshot for the day. |

*Provide `city`, `date`, or both.

```http
GET ${NEXT_PUBLIC_BASE_URL}/api/weather?city=denver&date=2026-07-08
```

```json
{
  "city": "denver",
  "date": "2026-07-08",
  "rows": [
    {
      "city_slug": "denver",
      "date": "2026-07-08",
      "temp_min_c": 14.2,
      "temp_max_c": 31.5,
      "temp_day_c": 28.9,
      "humidity": 32,
      "wind_speed_ms": 4.6,
      "wind_deg": 180,
      "precip_mm": 0,
      "uvi": 8.1,
      "aqi": 2,
      "aqi_pm2_5": 6.4,
      "aqi_o3": 92.3
    }
  ]
}
```

The date-only variant returns a compact per-city snapshot (`city_slug`, `date`, `temp_day_c`, `humidity`, `wind_speed_ms`, `aqi`).

## `GET /api/forecast`

48-hour hourly pollen forecast for one city (Ambee v3). Responses are cached server-side for up to 6 hours per city, and upstream fetches stop once the daily Ambee quota is nearly exhausted, in which case the most recent cached rows are served with `stale: true`.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `city`    | ✅        | City slug.  |

```http
GET ${NEXT_PUBLIC_BASE_URL}/api/forecast?city=denver
```

```json
{
  "city": "denver",
  "source": "cache",
  "stale": false,
  "fetchedAt": "2026-07-10T15:04:11.512Z",
  "rows": [
    {
      "ts": "2026-07-10T16:00:00.000Z",
      "tz": "America/Denver",
      "grass": 8,
      "tree": 3,
      "weed": 41,
      "total": 52,
      "species": {
        "Tree": { "Oak": 3 },
        "Grass": { "Grass": 8 },
        "Weed": { "Ragweed": 41 }
      },
      "risk_grass": "Moderate",
      "risk_tree": "Low",
      "risk_weed": "Moderate"
    }
  ]
}
```

`quotaExhausted: true` appears when the daily provider budget blocked a refresh; `rows` may then be stale or empty.

---

For complete parameter and response schemas, use the [OpenAPI document](/openapi.json).
