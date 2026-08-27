# API Changelog

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
