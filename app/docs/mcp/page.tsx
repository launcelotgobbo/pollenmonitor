import Link from 'next/link';

export const metadata = {
  title: 'MCP Server Guide',
  description: 'Use the pollen monitor API with Model Context Protocol clients.',
};

const badge =
  'inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-300 hover:text-slate-900';

export default function McpDocsPage() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pollenmonitor.dev';
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12 text-slate-900">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">MCP Server Guide</h1>
        <p className="text-sm text-slate-600">
          Wrap the pollen monitor API endpoints as an MCP REST provider so compatible assistants can answer pollen questions in real time.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/docs/api" className={badge}>
            API reference
          </Link>
          <Link href="/map" className={badge}>
            ← Back to map
          </Link>
        </div>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Example provider config</h2>
        <p className="text-sm leading-6 text-slate-600">
          Use the <code>@modelcontextprotocol/rest-provider</code> (or any compatible REST transport) and add the following configuration. Replace
          <code>{baseUrl}</code> if you run the server on a different host.
        </p>
        <pre className="overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100 shadow-inner">
{`{
  "$schema": "https://modelcontextprotocol.org/schemas/task-config.json",
  "name": "pollen-monitor",
  "version": "1.0.0",
  "description": "US pollen observations",
  "endpoints": [
    {
      "id": "pollen-city-hourly",
      "kind": "rest",
      "displayName": "City hourly pollen",
      "baseUrl": "${baseUrl}/api/pollen",
      "method": "GET",
      "query": {
        "city": {"type": "string", "required": true},
        "date": {"type": "string", "required": true}
      }
    },
    {
      "id": "pollen-city-daily",
      "kind": "rest",
      "displayName": "City daily averages",
      "baseUrl": "${baseUrl}/api/pollen",
      "method": "GET",
      "query": {
        "city": {"type": "string", "required": true}
      }
    },
    {
      "id": "pollen-range",
      "kind": "rest",
      "displayName": "Custom pollen range",
      "baseUrl": "${baseUrl}/api/pollen-range",
      "method": "GET",
      "query": {
        "from": {"type": "string", "required": true},
        "to": {"type": "string", "required": true},
        "city": {"type": "string"},
        "aggregate": {"type": "string", "enum": ["none", "day"], "default": "none"},
        "limit": {"type": "integer", "default": 20000}
      }
    }
  ]
}`}
        </pre>
      </section>

      <section className="space-y-3 text-sm leading-6 text-slate-600">
        <h2 className="text-xl font-semibold">Running the provider</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Save the JSON as <code>~/.mcp/pollen-monitor.json</code>.</li>
          <li>
            Start the provider:
            <pre className="mt-2 overflow-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100 shadow-inner">
npx @modelcontextprotocol/rest-provider serve --config ~/.mcp/pollen-monitor.json
            </pre>
          </li>
          <li>Connect your MCP-compatible assistant to the running provider.</li>
        </ol>
      </section>

      <section className="space-y-3 text-sm leading-6 text-slate-600">
        <h2 className="text-xl font-semibold">Tool outputs</h2>
        <p>
          The provider exposes three tools: <code>pollen-city-hourly</code>, <code>pollen-city-daily</code>, and <code>pollen-range</code>. Each mirrors the REST endpoints described in the
          <Link href="/docs/api" className="ml-1 underline decoration-slate-400 hover:text-slate-700">
            API reference
          </Link>
          . Responses include the same fields as the HTTP endpoints, making them easy to feed into downstream reasoning.
        </p>
      </section>

      <footer className="border-t border-slate-200 pt-6 text-xs text-slate-500">
        Need additional endpoints? Extend <code>app/api/</code> and add matching entries in your MCP configuration.
      </footer>
    </div>
  );
}
