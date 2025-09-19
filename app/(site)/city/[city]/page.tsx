import { notFound } from 'next/navigation';
import CityPicker from '@/components/CityPicker';
import Link from 'next/link';
import CityDateSelector from '@/components/CityDateSelector';

type Props = { params: { city: string }; searchParams?: Record<string, string> };

export const revalidate = 3600; // cache city history for 1 hour

export default async function CityPage({ params, searchParams }: Props) {
  const city = decodeURIComponent(params.city || '').trim();
  if (!city) notFound();

  const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const datesRes = await fetch(`${base}/api/available-dates`, { next: { revalidate } });
  const datesJson = await datesRes.json();
  const dates: string[] = Array.isArray(datesJson?.dates) ? datesJson.dates : [];
  const selected = searchParams?.date && dates.includes(searchParams.date) ? searchParams.date : dates[0];

  const hourlyUrl = new URL(`${base}/api/pollen`);
  hourlyUrl.searchParams.set('city', city);
  if (selected) hourlyUrl.searchParams.set('date', selected);
  const res = await fetch(hourlyUrl.toString(), { next: { revalidate } });
  const data = await res.json();

  const rows: any[] = Array.isArray(data?.rows) ? data.rows : [];
  const timezone = rows.find((row) => row.timezone)?.timezone || 'UTC';
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone || 'UTC',
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

  const averageTotal = summary.sampleCount ? Math.round(summary.totalCount / summary.sampleCount) : 0;

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
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">Hourly pollen</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">{cityLabel}</h2>
          <p className="text-sm text-slate-500">
            Showing Ambee readings for {selected || 'the latest available date'} in {timezone}.
          </p>
        </div>
        <Link
          href="/map"
          className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
        >
          ← Back to map
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-6">
            <CityPicker current={city} />
            <CityDateSelector city={city} dates={dates} selected={selected} />
            <div className="space-y-3 text-sm text-slate-600">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-4 shadow-inner">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Peak total</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">{summary.maxTotal}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 shadow-inner">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Avg total</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">{averageTotal}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 shadow-inner">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Peak weed</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">{summary.maxWeed}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 shadow-inner">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Samples</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">{summary.sampleCount}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Counts shown in particles/m³. Risk levels are provided directly by Ambee for each hour.
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Time ({timezone})</th>
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
                    return (
                      <tr key={row.ts} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-medium text-slate-700">{timeLabel}</td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-700">{row.tree ?? '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-lime-700">{row.grass ?? '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-amber-700">{row.weed ?? '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{row.total ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${riskBadgeClass(row.risk_tree)}`}>
                              Tree {row.risk_tree ?? '—'}
                            </span>
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${riskBadgeClass(row.risk_grass)}`}>
                              Grass {row.risk_grass ?? '—'}
                            </span>
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${riskBadgeClass(row.risk_weed)}`}>
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
              <p className="text-sm font-medium text-slate-600">No hourly readings found for this date.</p>
              <p className="mt-2 text-xs text-slate-500">Try selecting a different date or city.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
