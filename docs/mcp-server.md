# Hosted MCP Server

Pollen Monitor exposes a public, read-only Model Context Protocol server at:

```text
https://pollenmonitor.dev/mcp
```

Clients that support remote Streamable HTTP servers can connect directly:

```json
{
  "pollen-monitor": {
    "url": "https://pollenmonitor.dev/mcp"
  }
}
```

No local provider or API credentials are required.

## Tools

- `list_cities`: List supported city names and slugs.
- `get_pollen`: Get daily city history or hourly readings for one UTC date.
- `get_pollen_range`: Get bounded hourly or daily data for a date range.
- `get_forecast`: Get a city's cached 48-hour pollen forecast without refreshing
  the provider.
- `get_weather`: Get city weather and air-quality history.

All tool inputs are validated, range results are capped at 2,000 rows, and all
tools are read-only.

## Older clients

For clients that support only local stdio servers, bridge the hosted endpoint
with [`mcp-remote`](https://www.npmjs.com/package/mcp-remote):

```bash
npx -y mcp-remote https://pollenmonitor.dev/mcp
```

See [`docs/api.md`](./api.md) for the underlying REST payloads and parameters.
