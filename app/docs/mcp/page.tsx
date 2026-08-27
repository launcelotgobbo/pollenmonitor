import Link from 'next/link';
import { API_VERSION } from '@/lib/api-version';
import { SITE_URL } from '@/lib/site';

export const metadata = {
  title: 'MCP Server Guide',
  description: 'Use the pollen monitor API with Model Context Protocol clients.',
};

const badge =
  'inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-300 hover:text-slate-900';

export default function McpDocsPage() {
  const baseUrl = SITE_URL;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12 text-slate-900">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Hosted MCP Server</h1>
        <p className="text-sm text-slate-600">
          Connect an MCP-compatible assistant directly to Pollen Monitor&apos;s public,
          read-only Streamable HTTP endpoint.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/docs/api" className={badge}>
            API reference
          </Link>
          <Link href="/docs/changelog" className={badge}>
            Changelog
          </Link>
          <Link href="/docs/api/explorer" className={badge}>
            Interactive API
          </Link>
          <Link href="/map" className={badge}>
            ← Back to map
          </Link>
        </div>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Connect directly</h2>
        <p className="text-sm leading-6 text-slate-600">
          Clients that support remote Streamable HTTP servers need only this URL. No local
          provider installation is required.
        </p>
        <pre className="overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100 shadow-inner">
{`{
  "pollen-monitor": {
    "url": "${baseUrl}/mcp"
  }
}`}
        </pre>
      </section>

      <section className="space-y-3 text-sm leading-6 text-slate-600">
        <h2 className="text-xl font-semibold">Available tools</h2>
        <p>
          The server exposes <code>list_cities</code>, <code>get_pollen</code>,{' '}
          <code>get_pollen_range</code>, <code>get_forecast</code>, and{' '}
          <code>get_weather</code>. Inputs are validated and bounded; every tool is
          read-only, and forecasts are served from the existing cache without consuming
          provider quota. Responses mirror the
          <Link href="/docs/api" className="ml-1 underline decoration-slate-400 hover:text-slate-700">
            API reference
          </Link>
          .
        </p>
        <p>
          Every tool advertises an <code>outputSchema</code>. Successful calls return
          both JSON text and schema-validated <code>structuredContent</code>; failures
          set <code>isError: true</code> with an actionable message. The MCP server
          reports contract version <code>{API_VERSION}</code>.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Example tool input</h2>
        <p className="text-sm leading-6 text-slate-600">
          Request a bounded daily range after resolving the city with{' '}
          <code>list_cities</code>:
        </p>
        <pre className="overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100 shadow-inner">
{`{
  "name": "get_pollen_range",
  "arguments": {
    "city": "berkeley",
    "from": "2026-08-20",
    "to": "2026-08-27",
    "aggregate": "day",
    "limit": 500
  }
}`}
        </pre>
        <p className="text-sm leading-6 text-slate-600">
          Date-range upper bounds are exclusive. Daily history and{' '}
          <code>aggregate=day</code> return averages; cross-city map values are daily
          category maxima.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-slate-600">
        <h2 className="text-xl font-semibold">Older clients</h2>
        <p>
          For clients that support only local stdio servers, bridge the hosted endpoint with
          <code className="ml-1">mcp-remote</code>:
        </p>
        <pre className="overflow-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100 shadow-inner">
{`npx -y mcp-remote ${baseUrl}/mcp`}
        </pre>
      </section>

      <footer className="border-t border-slate-200 pt-6 text-xs text-slate-500">
        The MCP endpoint is public and requires no credentials. Use the REST API directly
        when MCP is not available.
      </footer>
    </div>
  );
}
