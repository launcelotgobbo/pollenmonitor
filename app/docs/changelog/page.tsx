import Link from 'next/link';

export const metadata = {
  title: 'API Changelog',
  description: 'Breaking and additive changes to the Pollen Monitor API and MCP server.',
};

const linkStyles =
  'inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900';

export default function ChangelogPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12 text-slate-900">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">API Changelog</h1>
        <p className="text-sm leading-6 text-slate-600">
          Breaking and additive contract changes for the REST API and hosted MCP server.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/docs/api" className={linkStyles}>
            API reference
          </Link>
          <Link href="/docs/mcp" className={linkStyles}>
            MCP guide
          </Link>
        </div>
      </header>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
            August 26, 2026
          </p>
          <h2 className="mt-1 text-2xl font-semibold">2.2.0</h2>
        </div>
        <div className="space-y-3 text-sm leading-6 text-slate-600">
          <h3 className="font-semibold text-slate-900">Added</h3>
          <ul className="list-disc space-y-2 pl-5">
            <li>Interactive Swagger UI for safe live read-only requests.</li>
            <li>
              Full OpenAPI response examples and curl, JavaScript, and Python
              samples for every operation.
            </li>
            <li>Explicit MCP output schemas with validated structured content.</li>
            <li>Expanded agent workflow and response guidance in <code>/llms.txt</code>.</li>
            <li>Redocly OpenAPI validation in local tooling and CI.</li>
          </ul>
          <h3 className="font-semibold text-slate-900">Fixed</h3>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Exact forecast rows and complete map feature properties are now
              reflected in OpenAPI.
            </li>
          </ul>
        </div>
      </section>

      <section className="space-y-4 border-t border-slate-200 pt-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
            August 26, 2026
          </p>
          <h2 className="mt-1 text-2xl font-semibold">2.1.0</h2>
        </div>
        <div className="space-y-3 text-sm leading-6 text-slate-600">
          <h3 className="font-semibold text-slate-900">Added</h3>
          <ul className="list-disc space-y-2 pl-5">
            <li>Wildcard CORS on public read-only REST routes.</li>
            <li>Explicit daily-category-maximum metadata and labeling for map values.</li>
            <li>Five-minute shared edge caching with stale-while-revalidate.</li>
          </ul>
          <h3 className="font-semibold text-slate-900">Changed</h3>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Invalid, zero, negative, fractional, and oversized <code>limit</code>{' '}
              values now return <code>400</code>.
            </li>
          </ul>
        </div>
      </section>

      <section className="space-y-4 border-t border-slate-200 pt-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
            August 26, 2026
          </p>
          <h2 className="mt-1 text-2xl font-semibold">2.0.1</h2>
        </div>
        <div className="space-y-3 text-sm leading-6 text-slate-600">
          <h3 className="font-semibold text-slate-900">Fixed</h3>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Malformed and impossible date parameters now return <code>400</code>{' '}
              before querying the database.
            </li>
            <li>
              Database connection and query failures are distinguished in private logs,
              while public errors no longer expose configuration hints.
            </li>
          </ul>
        </div>
      </section>

      <section className="space-y-4 border-t border-slate-200 pt-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
            August 26, 2026
          </p>
          <h2 className="mt-1 text-2xl font-semibold">2.0.0</h2>
        </div>
        <div className="space-y-3 text-sm leading-6 text-slate-600">
          <h3 className="font-semibold text-slate-900">Breaking changes</h3>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Daily pollen rows now use <code>tree</code>, <code>grass</code>,{' '}
              <code>weed</code>, and <code>total</code> instead of <code>avg_*</code>{' '}
              names.
            </li>
            <li>
              Pollen-range hourly and daily modes now return one flat row shape.
            </li>
          </ul>
          <h3 className="font-semibold text-slate-900">Added</h3>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              One documented <code>404 UNSUPPORTED_CITY</code> response across all
              city-aware REST operations, with the same actionable error message from
              MCP tools.
            </li>
            <li>Hosted MCP discovery metadata in OpenAPI.</li>
            <li>Complete pollen data in the initial server-rendered city page HTML.</li>
          </ul>
        </div>
      </section>

      <section className="space-y-2 border-t border-slate-200 pt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          September 20, 2025
        </p>
        <h2 className="text-xl font-semibold">1.0.0</h2>
        <p className="text-sm leading-6 text-slate-600">
          Initial public pollen, forecast, weather, map, OpenAPI, and discovery
          endpoints.
        </p>
      </section>
    </div>
  );
}
