import { notFound } from 'next/navigation';
import Link from 'next/link';
import CityDailyExplorer, { DailySummary, HourlyRow } from '@/components/CityDailyExplorer';

type Props = { params: { city: string }; searchParams?: Record<string, string> };

export const revalidate = 3600; // cache city history for 1 hour

export default async function CityPage({ params, searchParams }: Props) {
  const city = decodeURIComponent(params.city || '').trim();
  if (!city) notFound();

  const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  const dailyUrl = new URL(`${base}/api/pollen`);
  dailyUrl.searchParams.set('city', city);
  const dailyRes = await fetch(dailyUrl.toString(), { next: { revalidate } });
  const dailyJson = await dailyRes.json();
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
        }))
    : [];

  const selected =
    searchParams?.date && dailyRows.some((row) => row.date === searchParams.date)
      ? searchParams.date
      : dailyRows[0]?.date ?? null;

  let hourlyRows: HourlyRow[] = [];
  let timezone: string | null = null;

  if (selected) {
    const hourlyUrl = new URL(`${base}/api/pollen`);
    hourlyUrl.searchParams.set('city', city);
    hourlyUrl.searchParams.set('date', selected);
    const res = await fetch(hourlyUrl.toString(), { next: { revalidate } });
    const data = await res.json();
    hourlyRows = Array.isArray(data?.rows) ? (data.rows as HourlyRow[]) : [];
    const detectedTimezone = hourlyRows.find((row) => row.timezone)?.timezone;
    if (typeof detectedTimezone === 'string' && detectedTimezone.trim()) {
      timezone = detectedTimezone.trim();
    }
  }

  if (!timezone) {
    timezone = dailyRows.find((row) => row.date === selected)?.timezone || dailyRows[0]?.timezone || null;
  }

  const cityLabel = city.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">Daily pollen overview</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">{cityLabel}</h2>
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
