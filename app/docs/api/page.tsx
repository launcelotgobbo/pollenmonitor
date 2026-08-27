import Link from 'next/link';
import { API_VERSION } from '@/lib/api-version';
import { SITE_URL } from '@/lib/site';

export const metadata = {
  title: 'API Reference',
  description: 'Programmatic endpoints for the Pollen Monitor project.',
};

const linkStyles =
  'inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900';

export default function ApiDocsPage() {
  const baseUrl = SITE_URL;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12 text-slate-900">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">API Reference</h1>
        <p className="text-sm text-slate-600">
          Query public pollen, species, forecast, map, weather, and air-quality data. All data endpoints are read-only JSON.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/map" className={linkStyles}>
            ← Back to map
          </Link>
          <Link href="/docs/mcp" className={linkStyles}>
            MCP guide
          </Link>
          <Link href="/docs/changelog" className={linkStyles}>
            Changelog
          </Link>
          <a href="/openapi.json" className={linkStyles}>
            OpenAPI 3.1
          </a>
          <a href="/llms.txt" className={linkStyles}>
            Agent guide
          </a>
        </div>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Authentication</h2>
        <p className="text-sm leading-6 text-slate-600">
          API version {API_VERSION} endpoints are publicly readable and do not require an API key.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Available dates</h2>
        <pre className="overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100 shadow-inner">
{`GET ${baseUrl}/api/available-dates
GET ${baseUrl}/api/latest-date`}
        </pre>
        <p className="text-sm leading-6 text-slate-600">
          Discover all UTC dates with observations or retrieve only the latest observation date.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Units and risk methodology</h2>
        <p className="text-sm leading-6 text-slate-600">
          Values are modeled Ambee pollen concentrations in grains/m³. Risk labels use category-specific{' '}
          <a
            href="https://www.aaaai.org/global/nab-pollen-counts/reading-the-charts"
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline underline-offset-2"
          >
            National Allergy Bureau (NAB) ranges
          </a>
          : Weed/Ragweed 10, 50, 500; Grass 5, 20, 200; Tree 15, 90, 1500. Zero is None, and multi-species
          categories are graded by the highest individual allergen rather than the category sum.
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
          Provide both <code>city</code> and <code>date</code> (UTC) to retrieve all hourly observations for that day, including per-species values and NAB category risk labels.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Daily averages</h2>
        <pre className="overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100 shadow-inner">
{`GET ${baseUrl}/api/pollen?city=san-francisco`}
        </pre>
        <p className="text-sm leading-6 text-slate-600">
          Omit the <code>date</code> parameter to receive up to 720 daily averages for a city, including per-species averages rounded to whole numbers.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Cross-city map data</h2>
        <pre className="overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100 shadow-inner">
{`GET ${baseUrl}/api/map-data?date=latest`}
        </pre>
        <p className="text-sm leading-6 text-slate-600">
          Compact GeoJSON with one point per city, category and Ragweed values, NAB risks, coordinates, timezone, and a three-day series. Full species blobs are omitted to keep cross-city responses small.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">48-hour forecast</h2>
        <pre className="overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100 shadow-inner">
{`GET ${baseUrl}/api/forecast?city=denver`}
        </pre>
        <p className="text-sm leading-6 text-slate-600">
          Hourly pollen forecast for the next 48 hours (Ambee), including species when supplied by the provider. Responses are cached server-side for up to 6 hours per city; when the daily provider quota is nearly exhausted the most recent cached rows are returned with <code>stale: true</code> and <code>quotaExhausted: true</code>.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Daily weather</h2>
        <pre className="overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100 shadow-inner">
{`GET ${baseUrl}/api/weather?city=denver&date=2026-07-08`}
        </pre>
        <p className="text-sm leading-6 text-slate-600">
          Daily weather and air-quality observations (OpenWeather) collected alongside pollen data. Provide <code>city</code>, <code>date</code>, or both: <code>city</code> alone returns up to 365 days (newest first), <code>date</code> alone returns a compact per-city snapshot for that day. Measurements unavailable from the provider are omitted rather than returned as <code>null</code>.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Custom ranges</h2>
        <pre className="overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100 shadow-inner">
{`GET ${baseUrl}/api/pollen-range?from=2024-04-01&to=2024-04-15&city=denver&aggregate=day`}
        </pre>
        <p className="text-sm leading-6 text-slate-600">
          Use <code>/api/pollen-range</code> for arbitrary windows. Supply <code>from</code> and <code>to</code>, optionally filter by <code>city</code>, and set <code>aggregate=day</code> for daily summaries. Hourly and daily modes return the same flat row shape.
        </p>
        <p className="text-xs leading-5 text-slate-500">
          Parameters: <code>from</code> (required), <code>to</code> (required), <code>city</code> (comma-separated slugs), <code>aggregate</code> (strictly <code>none</code> or <code>day</code>; unknown values return 400), <code>limit</code> (1–50 000, defaults to 20 000).
        </p>
      </section>

      <footer className="border-t border-slate-200 pt-6 text-xs text-slate-500">
        Agents can discover every operation and schema through the{' '}
        <a href="/openapi.json" className="underline decoration-slate-400 hover:text-slate-700">
          OpenAPI document
        </a>
        . For MCP integrations, see the{' '}
        <Link href="/docs/mcp" className="underline decoration-slate-400 hover:text-slate-700">
          MCP server guide
        </Link>
        .
      </footer>
    </div>
  );
}
