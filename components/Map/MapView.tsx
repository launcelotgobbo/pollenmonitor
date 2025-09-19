'use client';

import { useEffect, useState } from 'react';
import MapCanvas from '@/components/Map/MapCanvas';

export default function MapView() {
  const [date, setDate] = useState<string>('');
  const [dates, setDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError(null);
      try {
        const [latestRes, listRes] = await Promise.all([
          fetch('/api/latest-date', { cache: 'no-store' }),
          fetch('/api/available-dates', { cache: 'no-store' }),
        ]);
        const latest = await latestRes.json();
        const list = await listRes.json();
        const all: string[] = Array.isArray(list?.dates) ? list.dates : [];
        const today = new Date().toISOString().slice(0, 10);
        const ds = all.filter((d) => d <= today);
        setDates(ds);
        const preferred = ds.find((d) => d === latest?.date) || ds[0] || '';
        setDate(preferred);
      } catch (e: any) {
        setError(e?.message || 'Failed to load the latest date');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-slate-950">
      <MapCanvas date={date} />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center px-4 py-4 sm:px-6">
        <div className="pointer-events-auto flex w-full max-w-xl flex-col gap-3 rounded-2xl bg-slate-900/75 px-4 py-3 text-slate-50 shadow-xl backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-wide text-slate-200 sm:flex-row sm:items-center sm:gap-3 sm:text-sm">
            <span className="text-slate-300">Date</span>
            <select
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={!dates.length}
              className="min-w-[160px] rounded-xl border-none bg-slate-800/80 px-3 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:cursor-not-allowed disabled:bg-slate-800/40"
            >
              {dates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1 text-xs text-slate-200 sm:text-sm">
            <span>Hover a city for counts • Tap to open details</span>
            {loading && <span className="text-[11px] uppercase tracking-wide text-slate-300">Loading map data…</span>}
            {error && <span className="text-[11px] uppercase tracking-wide text-rose-200">{error}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
