# MCP Server Integration

The Model Context Protocol (MCP) lets tools (like the GitHub Copilot agent or other compatible assistants) expose structured data sources. The pollen monitor API endpoints can be wrapped as an MCP "REST" server so assistants can fetch pollen data on demand.

Below is an example configuration using the [rest MCP transport](https://github.com/modelcontextprotocol/context-providers/tree/main/providers/rest). Replace `${NEXT_PUBLIC_BASE_URL}` with the value from your environment (default `https://pollenmonitor.dev`).

```jsonc
{
  "$schema": "https://modelcontextprotocol.org/schemas/task-config.json",
  "name": "pollen-monitor",
  "version": "1.0.0",
  "description": "US pollen observations from pollenmonitor",
  "endpoints": [
    {
      "id": "pollen-city-hourly",
      "kind": "rest",
      "displayName": "City hourly pollen",
      "docs": "Fetch hourly pollen readings for a city on a specific date.",
      "baseUrl": "${NEXT_PUBLIC_BASE_URL}/api/pollen",
      "path": "",
      "method": "GET",
      "query": {
        "city": { "type": "string", "required": true, "description": "City slug (e.g. denver)" },
        "date": { "type": "string", "required": true, "description": "UTC date YYYY-MM-DD" }
      }
    },
    {
      "id": "pollen-city-daily",
      "kind": "rest",
      "displayName": "City daily averages",
      "docs": "Return up to the last 720 daily averages for a city.",
      "baseUrl": "${NEXT_PUBLIC_BASE_URL}/api/pollen",
      "path": "",
      "method": "GET",
      "query": {
        "city": { "type": "string", "required": true }
      }
    },
    {
      "id": "pollen-range",
      "kind": "rest",
      "displayName": "Custom date range",
      "docs": "Pull hourly data or daily aggregates between two dates.",
      "baseUrl": "${NEXT_PUBLIC_BASE_URL}/api/pollen-range",
      "path": "",
      "method": "GET",
      "query": {
        "from": { "type": "string", "required": true, "description": "Start date (YYYY-MM-DD or ISO)" },
        "to": { "type": "string", "required": true, "description": "End date (exclusive)" },
        "city": { "type": "string", "required": false, "description": "Comma-separated city slugs" },
        "aggregate": { "type": "string", "required": false, "enum": ["none", "day"], "default": "none" },
        "limit": { "type": "integer", "required": false, "default": 20000 }
      }
    }
  ]
}
```

### Usage

1. Set `NEXT_PUBLIC_BASE_URL` to your deployment (for example `https://pollenmonitor.dev` or `http://localhost:3000`) and reuse it in the config above.
2. Save the configuration alongside your MCP client (for example `~/.mcp/pollen-monitor.json`).
3. Register the config in your MCP client. With the reference rest provider this is typically:

   ```bash
   npx @modelcontextprotocol/rest-provider serve --config ~/.mcp/pollen-monitor.json
   ```

4. The MCP client will now expose three tools (`pollen-city-hourly`, `pollen-city-daily`, `pollen-range`). Assistants can invoke them to retrieve structured pollen data.

### Notes

- All endpoints are read-only, so no authentication or write permissions are required.
- Respect the `limit` parameter to avoid large transfers (responses are capped at 50 000 records server-side).
- If you introduce additional API endpoints (e.g. forecast data), add matching entries to the configuration with unique `id`s.

Refer back to [`docs/api.md`](./api.md) for payload examples and parameter definitions.
