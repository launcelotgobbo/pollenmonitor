'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import MapCanvas from '@/components/Map/MapCanvas';
import Legend from '@/components/Map/Legend';
import type { PollenType } from '@/components/Map/pollenLayer';

const POLLEN_TYPES: { value: PollenType; label: string }[] = [
  { value: 'total', label: 'Total' },
  { value: 'tree', label: 'Tree' },
  { value: 'grass', label: 'Grass' },
  { value: 'ragweed', label: 'Ragweed' },
];

export default function MapView() {
  const [date, setDate] = useState<string>('');
  const [pollenType, setPollenType] = useState<PollenType>('total');
  const [dates, setDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The date list only feeds the dropdown; the map itself starts fetching the
  // latest day immediately (MapCanvas resolves "latest" server-side), so this
  // request never blocks the first render.
  useEffect(() => {
    async function loadDates() {
      setLoading(true);
      setError(null);
      try {
        const listRes = await fetch('/api/available-dates');
        const list = await listRes.json();
        const all: string[] = Array.isArray(list?.dates) ? list.dates : [];
        const today = new Date().toISOString().slice(0, 10);
        setDates(all.filter((d) => d <= today));
      } catch (e: any) {
        setError(e?.message || 'Failed to load available dates');
      } finally {
        setLoading(false);
      }
    }
    loadDates();
  }, []);

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-slate-950">
      <MapCanvas
        date={date}
        pollenType={pollenType}
        onDateResolved={(resolved) => setDate((prev) => prev || resolved)}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center px-4 py-4 sm:px-6">
        <div className="pointer-events-auto flex w-full max-w-2xl flex-col gap-3 rounded-2xl bg-slate-900/75 px-4 py-3 text-slate-50 shadow-xl backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-wide text-slate-200 sm:flex-row sm:items-center sm:gap-3 sm:text-sm">
              <span className="text-slate-300">Date</span>
              <select
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={!dates.length}
                className="min-w-[160px] rounded-xl border-none bg-slate-800/80 px-3 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:cursor-not-allowed disabled:bg-slate-800/40"
              >
                {(dates.length ? dates : date ? [date] : []).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>

            <div
              role="radiogroup"
              aria-label="Pollen type"
              className="flex items-center gap-1 rounded-xl bg-slate-800/80 p-1"
            >
              {POLLEN_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={pollenType === t.value}
                  onClick={() => setPollenType(t.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition sm:text-sm ${
                    pollenType === t.value
                      ? 'bg-sky-500 text-white shadow'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1 text-xs text-slate-200 sm:text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span>Hover city for current data</span>
              <span>•</span>
              <span>Tap to open details</span>
              <span>•</span>
              <Link
                href="/docs/api"
                className="underline decoration-slate-400 underline-offset-2 transition hover:text-white"
              >
                API / MCP docs
              </Link>
            </div>
            {loading && <span className="text-[11px] uppercase tracking-wide text-slate-300">Loading map data…</span>}
            {error && <span className="text-[11px] uppercase tracking-wide text-rose-200">{error}</span>}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-6 left-4 z-10 sm:left-6">
        <div className="pointer-events-auto">
          <Legend />
        </div>
      </div>
    </div>
  );
}
