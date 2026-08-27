# API Changelog

## 2.2.1 — 2026-08-26

### Fixed

- Forecast requests now serve existing cached rows with `stale: true` when an
  Ambee refresh fails; `500` is reserved for failures with no usable cache.
- The map control panel now has clearer grouping and instructions without
  stray separator bullets.

## 2.2.0 — 2026-08-26

### Added

- Interactive Swagger UI with safe live `GET` requests.
- Full OpenAPI success and error examples plus curl, JavaScript, and Python
  code samples for every operation.
- Explicit MCP output schemas with validated structured content for every tool.
- Expanded `/llms.txt` guidance covering tool selection, worked requests,
  aggregation semantics, response conventions, and error handling.
- Redocly OpenAPI validation in local tooling and CI.

### Fixed

- The OpenAPI forecast row schema now reflects nullable totals, the `tz`
  field, and the complete map feature properties.

## 2.1.0 — 2026-08-26

### Added

- Public read-only REST routes now support browser clients with wildcard CORS.
- Map GeoJSON and the map UI identify values as daily category maxima.
- Successful public data responses use a five-minute shared edge cache with
  stale-while-revalidate.

### Changed

- `limit` now accepts only integers from 1 through 50,000; malformed,
  fractional, zero, negative, and oversized values return `400`.

## 2.0.1 — 2026-08-26

### Fixed

- Date parameters now reject malformed and impossible calendar dates with a
  `400` response before any database query runs.
- Database connection and query failures are distinguished in private
  structured logs while clients receive one generic error without internal
  configuration hints.

## 2.0.0 — 2026-08-26

### Breaking

- Daily rows from `GET /api/pollen?city={slug}` now use `tree`, `grass`,
  `weed`, and `total` instead of the `avg_*` field names.
- `GET /api/pollen-range` now uses one flat row shape for hourly and daily
  aggregation modes.

### Added

- All city-aware REST operations return the same `404 UNSUPPORTED_CITY`
  contract with pointers to `/api/cities` and the MCP `list_cities` tool.
- All city-aware MCP tools return `isError: true` with the same actionable
  unsupported-city message.
- OpenAPI advertises the hosted MCP endpoint and documents the structured
  unsupported-city response.
- City pages render pollen measurements in their initial server HTML.

## 1.0.0 — 2025-09-20

- Initial public pollen, forecast, weather, map, OpenAPI, and discovery
  endpoints.
