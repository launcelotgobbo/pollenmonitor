'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import CityDailySummaryList from '@/components/CityDailySummaryList';
import CityPicker from '@/components/CityPicker';

export type DailySummary = {
  date: string;
  avg_tree: number | null;
  avg_grass: number | null;
  avg_weed: number | null;
  avg_total: number | null;
  timezone: string | null;
};

export type HourlyRow = {
  ts: string;
  tree: number | null;
  grass: number | null;
  weed: number | null;
  total: number | null;
  risk_tree: string | null;
  risk_grass: string | null;
  risk_weed: string | null;
  timezone: string | null;
};

type Props = {
  city: string;
  summaries: DailySummary[];
  initialSelected: string | null;
  initialHourly: HourlyRow[];
  initialTimezone: string | null;
};

const timeFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getTimeFormatter(timezone: string) {
  if (!timeFormatterCache.has(timezone)) {
    timeFormatterCache.set(
      timezone,
      new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        hourCycle: 'h23',
        timeZone: timezone,
      }),
    );
  }
  return timeFormatterCache.get(timezone)!;
}

function formatLongDate(date: string | null) {
  if (!date) return null;
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

function riskBadgeClass(value?: string | null) {
  if (!value) return 'bg-slate-100 text-slate-600';
  const normalized = value.toString().toLowerCase();
  if (['very high', 'severe', 'extreme'].includes(normalized)) return 'bg-rose-100 text-rose-700';
  if (['high'].includes(normalized)) return 'bg-orange-100 text-orange-700';
  if (['moderate', 'medium'].includes(normalized)) return 'bg-amber-100 text-amber-700';
  if (['low', 'very low', 'minimal'].includes(normalized)) return 'bg-emerald-100 text-emerald-700';
  return 'bg-slate-100 text-slate-600';
}

function getTimezoneFromRows(rows: HourlyRow[], fallback: string | null) {
  const fromRow = rows.find((row) => row.timezone)?.timezone;
  const tz = typeof fromRow === 'string' && fromRow.trim().length ? fromRow.trim() : fallback;
  return tz || 'UTC';
}

export default function CityDailyExplorer({ city, summaries, initialSelected, initialHourly, initialTimezone }: Props) {
  const [selectedDate, setSelectedDate] = useState(initialSelected);
  const [hourlyRows, setHourlyRows] = useState<HourlyRow[]>(initialHourly);
  const [timezone, setTimezone] = useState(() => getTimezoneFromRows(initialHourly, initialTimezone));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialDateRef = useRef(initialSelected);
  const initialRowsRef = useRef(initialHourly);
  const abortRef = useRef<AbortController | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    async function load(date: string | null) {
      if (!date) {
        setHourlyRows([]);
        setTimezone('UTC');
        return;
      }

      if (date === initialDateRef.current) {
        setHourlyRows(initialRowsRef.current);
        setTimezone(getTimezoneFromRows(initialRowsRef.current, initialTimezone));
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/pollen?city=${encodeURIComponent(city)}&date=${encodeURIComponent(date)}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const json = await response.json();
        const rows = Array.isArray(json?.rows) ? (json.rows as HourlyRow[]) : [];
        setHourlyRows(rows);
        setTimezone(getTimezoneFromRows(rows, initialTimezone));
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.error('[city-daily-explorer] failed to load hourly data', err);
        setError('Unable to load hourly data for this day.');
      } finally {
        setIsLoading(false);
      }
    }

    load(selectedDate ?? null);
  }, [city, initialTimezone, selectedDate]);

  const selectedDaily = useMemo(
    () => summaries.find((row) => row.date === selectedDate) ?? null,
    [summaries, selectedDate],
  );

  const summary = useMemo(() => {
    return hourlyRows.reduce(
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
  }, [hourlyRows]);

  const averageTotal = summary.sampleCount ? Math.round(summary.totalCount / summary.sampleCount) : null;
  const selectedLabel = formatLongDate(selectedDate);
  const formatter = useMemo(() => getTimeFormatter(timezone), [timezone]);

  const handleSelect = (date: string) => {
    setSelectedDate(date);
    startTransition(() => {
      try {
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          if (date) {
            url.searchParams.set('date', date);
          } else {
            url.searchParams.delete('date');
          }
          window.history.replaceState(null, '', `${url.pathname}${url.search ? `?${url.search}` : ''}`);
        }
      } catch (err) {
        console.error('[city-daily-explorer] failed to update URL', err);
      }
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[320px,1fr]">
      <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-6">
          <CityPicker current={city} />
          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-slate-600">Daily averages</p>
              <p className="text-xs text-slate-500">
                Rounded mean counts per category across the last {summaries.length.toLocaleString('en-US')} day(s).
              </p>
            </div>
            <CityDailySummaryList days={summaries} selected={selectedDate ?? undefined} onSelect={handleSelect} />
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
                  {timezone}
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

            {hourlyRows.length ? (
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
          {hourlyRows.length ? (
            <div className="max-w-full overflow-x-auto">
              <table className="min-w-full table-fixed divide-y divide-slate-200 text-xs sm:text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
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
                {hourlyRows.map((row) => {
                  const rawLabel = formatter.format(new Date(row.ts));
                  const timeLabel = rawLabel.startsWith('24:') ? rawLabel.replace(/^24:/, '00:') : rawLabel;
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

          {isLoading ? (
            <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-2 text-center text-xs font-medium uppercase tracking-wide text-slate-500">
              Loading hourly data…
            </div>
          ) : null}
          {error ? (
            <div className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-center text-xs font-medium text-rose-700">
              {error}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
