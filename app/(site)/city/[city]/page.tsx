import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import Link from 'next/link';
import CityDailyExplorer, { DailySummary, HourlyRow } from '@/components/CityDailyExplorer';
import { normalizeSpecies } from '@/lib/species';
import { absoluteUrl, cityDisplayName, normalizeCitySlug } from '@/lib/site';

type Props = {
  params: Promise<{ city: string }>;
  searchParams?: Promise<Record<string, string | undefined>>;
};

export const revalidate = 3600; // cache city history for 1 hour

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = normalizeCitySlug((await params).city);
  const cityLabel = cityDisplayName(city);
  const title = `${cityLabel} Pollen Count and Ragweed Forecast`;
  const description = `Check ${cityLabel} tree, grass, and ragweed pollen counts, species breakdowns, NAB risk levels, history, and the next 48-hour forecast.`;
  const canonical = `/city/${encodeURIComponent(city)}`;

  return {
    title,
    description,
    keywords: [
      `${cityLabel} pollen count`,
      `${cityLabel} ragweed`,
      `${cityLabel} allergy forecast`,
      `${cityLabel} tree pollen`,
      `${cityLabel} grass pollen`,
    ],
    alternates: { canonical },
    openGraph: {
      type: 'website',
      title,
      description,
      url: canonical,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

async function getApiBaseUrl() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  if (process.env.NODE_ENV === 'development') {
    const host = (await headers()).get('host')?.trim();
    if (host && /^(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(host)) {
      return `http://${host}`;
    }
  }

  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

async function readJson(response: Response, endpoint: string): Promise<any | null> {
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.toLowerCase().includes('application/json')) {
    console.error('[city-page] API returned a non-JSON response', {
      endpoint,
      status: response.status,
      contentType,
    });
    return null;
  }

  try {
    return await response.json();
  } catch {
    console.error('[city-page] API returned invalid JSON', { endpoint, status: response.status });
    return null;
  }
}

export default async function CityPage({ params, searchParams }: Props) {
  const city = normalizeCitySlug((await params).city);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  if (!city) notFound();

  const base = await getApiBaseUrl();

  const dailyUrl = new URL(`${base}/api/pollen`);
  dailyUrl.searchParams.set('city', city);
  const dailyRes = await fetch(dailyUrl.toString(), { next: { revalidate } });
  const dailyJson = await readJson(dailyRes, 'daily pollen');
  const dailyRows: DailySummary[] = Array.isArray(dailyJson?.rows)
    ? dailyJson.rows
        .filter((row: any) => row && typeof row.date === 'string')
        .map((row: any) => ({
          date: row.date,
          avg_tree: typeof row.avg_tree === 'number' ? row.avg_tree : null,
          avg_grass: typeof row.avg_grass === 'number' ? row.avg_grass : null,
          avg_weed: typeof row.avg_weed === 'number' ? row.avg_weed : null,
          avg_total: typeof row.avg_total === 'number' ? row.avg_total : null,
          timezone: typeof row.timezone === 'string' && row.timezone.trim() ? row.timezone : null,
          species: normalizeSpecies(row.species),
          risk_tree: typeof row.risk_tree === 'string' ? row.risk_tree : null,
          risk_grass: typeof row.risk_grass === 'string' ? row.risk_grass : null,
          risk_weed: typeof row.risk_weed === 'string' ? row.risk_weed : null,
        }))
    : [];

  const selected =
    resolvedSearchParams?.date && dailyRows.some((row) => row.date === resolvedSearchParams.date)
      ? resolvedSearchParams.date
      : dailyRows[0]?.date ?? null;

  let hourlyRows: HourlyRow[] = [];
  let timezone: string | null = null;

  if (selected) {
    const hourlyUrl = new URL(`${base}/api/pollen`);
    hourlyUrl.searchParams.set('city', city);
    hourlyUrl.searchParams.set('date', selected);
    const res = await fetch(hourlyUrl.toString(), { next: { revalidate } });
    const data = await readJson(res, 'hourly pollen');
    hourlyRows = Array.isArray(data?.rows) ? (data.rows as HourlyRow[]) : [];
    const detectedTimezone = hourlyRows.find((row) => row.timezone)?.timezone;
    if (typeof detectedTimezone === 'string' && detectedTimezone.trim()) {
      timezone = detectedTimezone.trim();
    }
  }

  if (!timezone) {
    timezone = dailyRows.find((row) => row.date === selected)?.timezone || dailyRows[0]?.timezone || null;
  }

  const cityLabel = cityDisplayName(city);
  const selectedDaily = dailyRows.find((row) => row.date === selected) ?? null;
  const cityUrl = absoluteUrl(`/city/${encodeURIComponent(city)}`);
  const apiUrl = new URL('/api/pollen', absoluteUrl('/'));
  apiUrl.searchParams.set('city', city);
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `${cityLabel} pollen counts and forecast`,
    description: `Modeled hourly and daily tree, grass, ragweed, and species-level pollen data for ${cityLabel}, with National Allergy Bureau risk levels.`,
    url: cityUrl,
    isAccessibleForFree: true,
    creator: {
      '@type': 'Organization',
      name: 'Pollen Monitor',
      url: absoluteUrl('/'),
    },
    spatialCoverage: {
      '@type': 'Place',
      name: cityLabel,
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'US',
      },
    },
    temporalCoverage:
      dailyRows.length > 0
        ? `${dailyRows[dailyRows.length - 1]?.date}/${dailyRows[0]?.date}`
        : undefined,
    variableMeasured: [
      'Tree pollen concentration',
      'Grass pollen concentration',
      'Ragweed pollen concentration',
      'Species pollen concentration',
      'National Allergy Bureau risk level',
    ],
    measurementTechnique: 'Ambee modeled pollen concentration, reported in grains per cubic meter',
    distribution: {
      '@type': 'DataDownload',
      encodingFormat: 'application/json',
      contentUrl: apiUrl.toString(),
    },
  };

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">Daily pollen overview</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{cityLabel} pollen count</h1>
          <p className="text-sm text-slate-500">
            Aggregated Ambee readings across the last {dailyRows.length.toLocaleString('en-US')} day(s). Select a day to load
            hourly detail.
          </p>
        </div>
        <Link
          href="/map"
          className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
        >
          ← Back to map
        </Link>
      </div>

      <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-900">
        Risk levels use category-specific{' '}
        <a
          href="https://www.aaaai.org/global/nab-pollen-counts/reading-the-charts"
          target="_blank"
          rel="noreferrer"
          className="font-semibold underline underline-offset-2"
        >
          National Allergy Bureau thresholds
        </a>
        . Weed is labeled Ragweed because it is the sole weed species in the current multi-region dataset.
      </div>

      {selectedDaily ? (
        <section aria-labelledby="city-pollen-summary" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 id="city-pollen-summary" className="text-lg font-semibold text-slate-900">
            {cityLabel} pollen summary for {selectedDaily.date}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Modeled daily averages are {selectedDaily.avg_tree ?? 'unavailable'} grains/m³ tree pollen,{' '}
            {selectedDaily.avg_grass ?? 'unavailable'} grains/m³ grass pollen, and{' '}
            {selectedDaily.avg_weed ?? 'unavailable'} grains/m³ ragweed. NAB risk levels are tree{' '}
            {selectedDaily.risk_tree ?? 'unavailable'}, grass {selectedDaily.risk_grass ?? 'unavailable'}, and ragweed{' '}
            {selectedDaily.risk_weed ?? 'unavailable'}.
          </p>
        </section>
      ) : null}

      <CityDailyExplorer
        city={city}
        summaries={dailyRows}
        initialSelected={selected}
        initialHourly={hourlyRows}
        initialTimezone={timezone}
      />
    </div>
  );
}
