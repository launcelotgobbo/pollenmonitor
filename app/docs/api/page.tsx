import Link from 'next/link';

export const metadata = {
  title: 'API Reference',
  description: 'Programmatic endpoints for the Pollen Monitor project.',
};

const linkStyles =
  'inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900';

export default function ApiDocsPage() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pollenmonitor.dev';

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12 text-slate-900">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">API Reference</h1>
        <p className="text-sm text-slate-600">
          Query pollen measurements programmatically with lightweight, read-only endpoints. All responses are JSON and rate-limit friendly.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/map" className={linkStyles}>
            ← Back to map
          </Link>
          <Link href="/docs/mcp" className={linkStyles}>
            MCP guide
          </Link>
        </div>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Authentication</h2>
        <p className="text-sm leading-6 text-slate-600">
          Endpoints are publicly readable and do not require an API key. If you build on top of them, please cache responses where possible and avoid high-frequency polling.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Cities</h2>
        <pre className="overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100 shadow-inner">
{`GET ${baseUrl}/api/cities`}
        </pre>
        <p className="text-sm leading-6 text-slate-600">
          Returns an alphabetised list of supported cities with both display names and URL-safe slugs.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Hourly readings</h2>
        <pre className="overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100 shadow-inner">
{`GET ${baseUrl}/api/pollen?city=san-francisco&date=2024-04-14`}
        </pre>
        <p className="text-sm leading-6 text-slate-600">
          Provide both <code>city</code> and <code>date</code> (UTC) to retrieve all hourly observations for that day, including category risk labels.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Daily averages</h2>
        <pre className="overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100 shadow-inner">
{`GET ${baseUrl}/api/pollen?city=san-francisco`}
        </pre>
        <p className="text-sm leading-6 text-slate-600">
          Omit the <code>date</code> parameter to receive up to 720 daily averages for a city, rounded to whole numbers.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Custom ranges</h2>
        <pre className="overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100 shadow-inner">
{`GET ${baseUrl}/api/pollen-range?from=2024-04-01&to=2024-04-15&city=denver&aggregate=day`}
        </pre>
        <p className="text-sm leading-6 text-slate-600">
          Use <code>/api/pollen-range</code> for arbitrary windows. Supply <code>from</code> and <code>to</code>, optionally filter by <code>city</code>, and set <code>aggregate=day</code> for grouped summaries.
        </p>
        <p className="text-xs leading-5 text-slate-500">
          Parameters: <code>from</code> (required), <code>to</code> (required), <code>city</code> (comma-separated slugs), <code>aggregate</code> (either <code>none</code> or <code>day</code>), <code>limit</code> (1–50 000, defaults to 20 000).
        </p>
      </section>

      <footer className="border-t border-slate-200 pt-6 text-xs text-slate-500">
        Need additional slices or metrics? Reach out via the project repository. For MCP integrations, see the{' '}
        <Link href="/docs/mcp" className="underline decoration-slate-400 hover:text-slate-700">
          MCP server guide
        </Link>
        .
      </footer>
    </div>
  );
}
