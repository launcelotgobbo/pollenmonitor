# Pollen Monitor API

The application exposes several read-only endpoints so you can query pollen observations programmatically. All endpoints return JSON and live under the same origin as the app (for example `${NEXT_PUBLIC_BASE_URL}`, which defaults to `https://pollenmonitor.dev`). For MCP integration notes see [mcp-server.md](./mcp-server.md).

> **Note:** These endpoints do not require authentication. If you open them publicly, make sure to enforce your own rate limits.

## `GET /api/cities`

Alphabetised list of supported cities.

```http
GET ${NEXT_PUBLIC_BASE_URL}/api/cities
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
      "risk_tree": "low",
      "risk_grass": "low",
      "risk_weed": null,
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
    { "date": "2024-04-14", "avg_tree": 19, "avg_grass": 7, "avg_weed": 2, "avg_total": 28, "timezone": "America/Los_Angeles" }
  ]
}
```

## `GET /api/pollen-range`

Query data over arbitrary date windows. Supports hourly data (`aggregate=none`, the default) or per-day averages (`aggregate=day`). Optional `city` accepts a comma-separated list; omit it for all cities.

| Parameter   | Required | Description                                     |
|-------------|----------|-------------------------------------------------|
| `from`      | ✅        | Start (inclusive). Accepts `YYYY-MM-DD` or ISO. |
| `to`        | ✅        | End (exclusive). Must be after `from`.         |
| `city`      | ❌        | Comma-separated city slugs.                     |
| `aggregate` | ❌        | `day` for daily averages, otherwise hourly.     |
| `limit`     | ❌        | Max rows to return (1–50 000, default 20 000).  |

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
      "city_slug": "denver",
      "ts": "2024-04-10T06:00:00.000Z",
      "tree": 32,
      "grass": 5,
      "weed": 0,
      "risk_tree": "moderate",
      "risk_grass": "low",
      "risk_weed": null,
      "tz": "America/Denver",
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
      "data": [
        { "date": "2024-04-01", "avg_tree": 24, "avg_grass": 3, "avg_weed": 0, "avg_total": 27, "timezone": "America/Denver" }
      ]
    }
  ]
}
```

Errors return a `400` with an explanatory message, for example:

```json
{ "error": "Parameter 'from' must be before 'to'" }
```

## `GET /api/weather`

Daily weather and air-quality observations (OpenWeather) collected alongside pollen data.

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
      "weather_main": "Clear",
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
      "risk_grass": "Low",
      "risk_tree": "Low",
      "risk_weed": "Moderate"
    }
  ]
}
```

`quotaExhausted: true` appears when the daily provider budget blocked a refresh; `rows` may then be stale or empty.

---

Extend the handlers under `app/api/` if you need additional slices or metrics.
