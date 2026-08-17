'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatNumeric, riskBadgeClass } from './format';
import { pickHigherRisk } from '@/lib/risk';

type ForecastRow = {
  ts: string;
  tz: string | null;
  grass: number | null;
  tree: number | null;
  weed: number | null;
  total: number | null;
  risk_grass: string | null;
  risk_tree: string | null;
  risk_weed: string | null;
};

type ForecastResponse = {
  city: string;
  source: string;
  stale?: boolean;
  quotaExhausted?: boolean;
  fetchedAt: string | null;
  rows: ForecastRow[];
};

function hourLabel(ts: string, timezone: string) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      hourCycle: 'h23',
      timeZone: timezone,
    }).format(new Date(ts));
  } catch {
    return ts.slice(5, 16).replace('T', ' ');
  }
}

export default function Forecast48h({ city }: { city: string }) {
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setData(null);
    fetch(`/api/forecast?city=${encodeURIComponent(city)}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || `HTTP ${res.status}`);
        return res.json();
      })
      .then((json: ForecastResponse) => {
        if (!cancelled) setData(json);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || 'Failed to load forecast');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [city]);

  const timezone = data?.rows.find((row) => row.tz)?.tz || 'UTC';

  const peak = useMemo(() => {
    if (!data?.rows.length) return null;
    return data.rows.reduce((best, row) => ((row.total ?? -1) > (best.total ?? -1) ? row : best));
  }, [data]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-600">Next 48 hours (forecast)</p>
          <p className="text-xs text-slate-500">
            Ambee hourly forecast in local time ({timezone}).
            {data?.fetchedAt ? ` Updated ${hourLabel(data.fetchedAt, timezone)}.` : ''}
          </p>
        </div>
        {data?.stale && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
            {data.quotaExhausted ? 'Daily API quota reached; showing cached data' : 'Cached data'}
          </span>
        )}
      </div>

      {isLoading && <p className="mt-4 text-sm text-slate-500">Loading forecast…</p>}
      {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
      {!isLoading && !error && !data?.rows.length && (
        <p className="mt-4 text-sm text-slate-500">
          No forecast available right now{data?.quotaExhausted ? ' (daily API quota reached)' : ''}. Try again later.
        </p>
      )}

      {!isLoading && !error && !!data?.rows.length && (
        <>
          {peak && (
            <p className="mt-3 text-sm text-slate-600">
              Peak total: <span className="font-semibold text-slate-900">{formatNumeric(peak.total)}</span> around{' '}
              <span className="font-semibold text-slate-900">{hourLabel(peak.ts, timezone)}</span>
            </p>
          )}
          <div className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-slate-100">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Local time</th>
                  <th className="px-4 py-2 text-right">Tree</th>
                  <th className="px-4 py-2 text-right">Grass</th>
                  <th className="px-4 py-2 text-right">Weed</th>
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((row) => {
                  const risk = pickHigherRisk(pickHigherRisk(row.risk_tree, row.risk_grass), row.risk_weed);
                  return (
                    <tr key={row.ts}>
                      <td className="px-4 py-2 text-slate-600">{hourLabel(row.ts, timezone)}</td>
                      <td className="px-4 py-2 text-right text-slate-700">{formatNumeric(row.tree)}</td>
                      <td className="px-4 py-2 text-right text-slate-700">{formatNumeric(row.grass)}</td>
                      <td className="px-4 py-2 text-right text-slate-700">{formatNumeric(row.weed)}</td>
                      <td className="px-4 py-2 text-right">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${riskBadgeClass(risk)}`}>
                          {formatNumeric(row.total)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
