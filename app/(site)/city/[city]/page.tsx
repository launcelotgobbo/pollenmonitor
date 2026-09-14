import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import CityDailyExplorer from '@/components/CityDailyExplorer';
import CityDailyHistoryTable from '@/components/CityDailyHistoryTable';
import { getSupportedCities, resolveCity, UnsupportedCityError } from '@/lib/cities';
import { getCompleteDailyPollenHistory, getLatestDailyPollenRow } from '@/lib/pollen';
import { absoluteUrl, cityDisplayName, normalizeCitySlug } from '@/lib/site';

type Props = {
  params: Promise<{ city: string }>;
};

export const revalidate = 3600; // cache city history for 1 hour

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = normalizeCitySlug((await params).city);
  const cityLabel = cityDisplayName(city);
  const title = `${cityLabel} Daily Pollen Count`;
  const description = `Check ${cityLabel} daily tree, grass, and ragweed pollen averages, peaks, species breakdowns, and NAB risk levels.`;
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

export default async function CityPage({ params }: Props) {
  const city = normalizeCitySlug((await params).city);
  if (!city) notFound();

  try {
    await resolveCity(city);
  } catch (error) {
    if (error instanceof UnsupportedCityError) notFound();
    throw error;
  }

  const [latestDaily, dailyRows, supportedCities] = await Promise.all([
    getLatestDailyPollenRow(city),
    getCompleteDailyPollenHistory(city),
    getSupportedCities(),
  ]);
  const cities = supportedCities.map(({ name, slug }) => ({ name, slug }));

  const cityLabel = cityDisplayName(city);
  const cityUrl = absoluteUrl(`/city/${encodeURIComponent(city)}`);
  const apiUrl = new URL('/api/pollen', absoluteUrl('/'));
  apiUrl.searchParams.set('city', city);
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `${cityLabel} daily pollen counts`,
    description: `Modeled daily tree, grass, ragweed, and species-level pollen data for ${cityLabel}, with averages, peaks, and National Allergy Bureau risk levels.`,
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
    <div className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
        }}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">
            Daily pollen overview
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {cityLabel} pollen count
          </h1>
          <p className="text-sm text-slate-500">
            Latest detail and daily averages and peaks across all{' '}
            {dailyRows.length.toLocaleString('en-US')} captured day(s).
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
        . Weed is labeled Ragweed because it is the sole weed species in the current multi-region
        dataset.
      </div>

      <CityDailyExplorer key={city} city={city} cities={cities} latestDaily={latestDaily} />
      <CityDailyHistoryTable days={dailyRows} />
    </div>
  );
}
