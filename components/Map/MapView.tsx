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
        const available = all.filter((candidate) => candidate <= today);
        setDates((current) =>
          [...new Set([...available, ...current])].sort((a, b) =>
            b.localeCompare(a),
          ),
        );
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
        onDateResolved={(resolved) => {
          setDate((current) => current || resolved);
          setDates((current) =>
            current.includes(resolved)
              ? current
              : [resolved, ...current].sort((a, b) => b.localeCompare(a)),
          );
        }}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center px-4 py-4 sm:px-6">
        <div className="pointer-events-auto flex w-full max-w-5xl flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/85 p-4 text-slate-50 shadow-2xl backdrop-blur-md lg:flex-row lg:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Observation date
              </span>
              <select
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={!dates.length}
                className="h-10 min-w-[170px] rounded-xl border border-white/10 bg-slate-800/90 px-3 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:cursor-not-allowed disabled:bg-slate-800/40"
              >
                {(dates.length ? dates : date ? [date] : []).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Pollen category
              </span>
              <div
                role="radiogroup"
                aria-label="Pollen category"
                className="grid h-10 grid-cols-4 gap-1 rounded-xl border border-white/10 bg-slate-800/90 p-1"
              >
                {POLLEN_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    role="radio"
                    aria-checked={pollenType === type.value}
                    onClick={() => setPollenType(type.value)}
                    className={`rounded-lg px-2 text-xs font-semibold transition sm:px-3 sm:text-sm ${
                      pollenType === type.value
                        ? 'bg-sky-500 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 pt-3 text-xs lg:w-56 lg:flex-col lg:items-start lg:justify-start lg:border-l lg:border-t-0 lg:pb-0.5 lg:pl-4 lg:pt-0">
            <div className="leading-5 text-slate-300">
              <p>Hover for daily maximum data</p>
              <p className="text-slate-400">Tap a city to open details</p>
            </div>
            <Link
              href="/docs/api"
              className="inline-flex items-center whitespace-nowrap rounded-full border border-white/15 bg-white/5 px-3 py-1.5 font-semibold text-slate-200 transition hover:border-sky-300/50 hover:bg-sky-400/10 hover:text-white"
            >
              API &amp; MCP docs
            </Link>
            {loading && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Loading map data…
              </span>
            )}
            {error && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-200">
                {error}
              </span>
            )}
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
