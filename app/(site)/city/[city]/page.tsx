import { notFound } from 'next/navigation';
import CityPicker from '@/components/CityPicker';
import CityDailySummaryList from '@/components/CityDailySummaryList';
import Link from 'next/link';

type Props = { params: { city: string }; searchParams?: Record<string, string> };
type DailySummary = {
  date: string;
  avg_tree: number | null;
  avg_grass: number | null;
  avg_weed: number | null;
  avg_total: number | null;
  timezone: string | null;
};

export const revalidate = 3600; // cache city history for 1 hour

function formatLongDate(date: string) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
    return formatter.format(new Date(`${date}T00:00:00Z`));
  } catch {
    return date;
  }
}

function formatNumeric(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-US') : '—';
}

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
      : dailyRows[0]?.date;

  const selectedDaily = selected ? dailyRows.find((row) => row.date === selected) ?? null : null;

  let rows: Array<any> = [];
  let timezone = selectedDaily?.timezone || null;

  if (selected) {
    const hourlyUrl = new URL(`${base}/api/pollen`);
    hourlyUrl.searchParams.set('city', city);
    hourlyUrl.searchParams.set('date', selected);
    const res = await fetch(hourlyUrl.toString(), { next: { revalidate } });
    const data = await res.json();
    rows = Array.isArray(data?.rows) ? data.rows : [];
    const detectedTimezone = rows.find((row) => row.timezone)?.timezone;
    if (typeof detectedTimezone === 'string' && detectedTimezone.trim()) {
      timezone = detectedTimezone;
    }
  }

  const resolvedTimezone = timezone || 'UTC';

  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: resolvedTimezone,
  });

  const cityLabel = city.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

  const summary = rows.reduce(
    (acc, row) => {
      const tree = typeof row.tree === 'number' ? row.tree : 0;
      const grass = typeof row.grass === 'number' ? row.grass : 0;
      const weed = typeof row.weed === 'number' ? row.weed : 0;
      const total = typeof row.total === 'number' ? row.total : tree + grass + weed;
      return {
        maxTree: Math.max(acc.maxTree, tree),
        maxGrass: Math.max(acc.maxGrass, grass),
        maxWeed: Math.max(acc.maxWeed, weed),
        maxTotal: Math.max(acc.maxTotal, total),
        totalCount: acc.totalCount + total,
        sampleCount: acc.sampleCount + 1,
      };
    },
    { maxTree: 0, maxGrass: 0, maxWeed: 0, maxTotal: 0, totalCount: 0, sampleCount: 0 },
  );

  const averageTotal = summary.sampleCount ? Math.round(summary.totalCount / summary.sampleCount) : null;
  const selectedLabel = selected ? formatLongDate(selected) : null;

  const riskBadgeClass = (value?: string | null) => {
    if (!value) return 'bg-slate-100 text-slate-600';
    const normalized = value.toString().toLowerCase();
    if (['very high', 'severe', 'extreme'].includes(normalized)) return 'bg-rose-100 text-rose-700';
    if (['high'].includes(normalized)) return 'bg-orange-100 text-orange-700';
    if (['moderate', 'medium'].includes(normalized)) return 'bg-amber-100 text-amber-700';
    if (['low', 'very low', 'minimal'].includes(normalized)) return 'bg-emerald-100 text-emerald-700';
    return 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">Daily pollen overview</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">{cityLabel}</h2>
          <p className="text-sm text-slate-500">
            Averages are rounded across hourly Ambee readings.{' '}
            {selectedLabel ? `Viewing ${selectedLabel} in ${resolvedTimezone}.` : 'Select a day to explore hourly detail.'}
          </p>
        </div>
        <Link
          href="/map"
          className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
        >
          ← Back to map
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px,1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-6">
            <CityPicker current={city} />
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-slate-600">Daily averages</p>
                <p className="text-xs text-slate-500">
                  Rounded mean counts per category across the last {dailyRows.length || 0} day(s).
                </p>
              </div>
              <CityDailySummaryList city={city} days={dailyRows} selected={selected ?? undefined} />
            </div>
          </div>
        </aside>

        <section className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="space-y-6 p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">Selected day snapshot</p>
                  <p className="text-xs text-slate-500">
                    {selectedLabel
                      ? `Averages and peaks derived from ${selectedLabel}.`
                      : 'Pick a day from the list to view hourly details.'}
                  </p>
                </div>
                {selectedLabel ? (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {resolvedTimezone}
                  </span>
                ) : null}
              </div>

              {selectedDaily ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 p-4 shadow-inner">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Avg total</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{formatNumeric(selectedDaily.avg_total)}</p>
                    <p className="mt-2 text-[11px] text-slate-500">particles/m³</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4 shadow-inner">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Avg tree</p>
                    <p className="mt-1 text-2xl font-semibold text-emerald-700">{formatNumeric(selectedDaily.avg_tree)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4 shadow-inner">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Avg grass</p>
                    <p className="mt-1 text-2xl font-semibold text-lime-700">{formatNumeric(selectedDaily.avg_grass)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4 shadow-inner">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Avg weed</p>
                    <p className="mt-1 text-2xl font-semibold text-amber-700">{formatNumeric(selectedDaily.avg_weed)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No averages available yet. Try a different city.</p>
              )}

              {rows.length ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-4 shadow-inner">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Peak total</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{summary.maxTotal.toLocaleString('en-US')}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4 shadow-inner">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Peak weed</p>
                    <p className="mt-1 text-2xl font-semibold text-amber-700">{summary.maxWeed.toLocaleString('en-US')}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4 shadow-inner">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Hourly samples</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{summary.sampleCount.toLocaleString('en-US')}</p>
                    {averageTotal != null ? (
                      <p className="mt-2 text-[11px] text-slate-500">Avg total per hour: {averageTotal.toLocaleString('en-US')}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {rows.length ? (
              <div className="max-w-full overflow-x-auto">
                <table className="min-w-full table-fixed divide-y divide-slate-200 text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Time ({resolvedTimezone})</th>
                      <th className="px-4 py-3 text-right">Tree</th>
                      <th className="px-4 py-3 text-right">Grass</th>
                      <th className="px-4 py-3 text-right">Weed</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-left">Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => {
                      const timeLabel = formatter.format(new Date(row.ts));
                      const treeValue = typeof row.tree === 'number' ? row.tree.toLocaleString('en-US') : '—';
                      const grassValue = typeof row.grass === 'number' ? row.grass.toLocaleString('en-US') : '—';
                      const weedValue = typeof row.weed === 'number' ? row.weed.toLocaleString('en-US') : '—';
                      const totalValue = typeof row.total === 'number' ? row.total.toLocaleString('en-US') : '—';
                      return (
                        <tr key={row.ts} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3 text-sm font-medium text-slate-700">{timeLabel}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-700">{treeValue}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-lime-700">{grassValue}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-amber-700">{weedValue}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">{totalValue}</td>
                          <td className="px-4 py-3">
                            <div className="flex max-w-[18rem] flex-wrap gap-2">
                              <span
                                className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${riskBadgeClass(row.risk_tree)}`}
                              >
                                Tree {row.risk_tree ?? '—'}
                              </span>
                              <span
                                className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${riskBadgeClass(row.risk_grass)}`}
                              >
                                Grass {row.risk_grass ?? '—'}
                              </span>
                              <span
                                className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${riskBadgeClass(row.risk_weed)}`}
                              >
                                Weed {row.risk_weed ?? '—'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-sm font-medium text-slate-600">
                  {selectedLabel ? 'No hourly readings found for this day.' : 'Select a day to view hourly readings.'}
                </p>
                <p className="mt-2 text-xs text-slate-500">Try a different date or city if data is missing.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
