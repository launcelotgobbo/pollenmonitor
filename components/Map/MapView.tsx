'use client';

import Link from 'next/link';
import { useState } from 'react';
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
  const [pollenType, setPollenType] = useState<PollenType>('total');
  const [resolvedDate, setResolvedDate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-slate-950">
      <MapCanvas
        date=""
        pollenType={pollenType}
        onDateResolved={setResolvedDate}
        onError={() => setError('Map data is unavailable.')}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-3 pt-3 sm:px-5 sm:pt-5">
        <div className="pointer-events-auto mx-auto flex w-full max-w-3xl items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/90 p-2.5 text-slate-50 shadow-2xl backdrop-blur-md sm:p-3">
          <Link href="/" className="hidden shrink-0 px-2 text-sm font-bold tracking-tight sm:block">
            Pollen Monitor
          </Link>
          <div
            role="radiogroup"
            aria-label="Pollen category"
            className="grid h-10 min-w-0 flex-1 grid-cols-4 gap-1 rounded-xl bg-slate-800/90 p-1"
          >
            {POLLEN_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                role="radio"
                aria-checked={pollenType === type.value}
                onClick={() => setPollenType(type.value)}
                className={`min-w-0 rounded-lg px-1 text-[11px] font-semibold transition sm:px-3 sm:text-sm ${
                  pollenType === type.value
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
          <div className="hidden shrink-0 text-right text-[10px] leading-4 text-slate-400 md:block">
            <p>{resolvedDate || 'Latest data'}</p>
            <p>Daily peak</p>
          </div>
        </div>
        {error ? (
          <p className="pointer-events-auto mx-auto mt-2 w-fit rounded-full bg-rose-950/90 px-3 py-1 text-xs text-rose-100">
            {error}
          </p>
        ) : null}
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 z-10 sm:bottom-5 sm:left-5">
        <div className="pointer-events-auto">
          <Legend />
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 z-10 hidden sm:block sm:bottom-5 sm:right-5">
        <Link
          href="/docs/api"
          className="pointer-events-auto rounded-full border border-white/10 bg-slate-950/80 px-3 py-2 text-[11px] font-semibold text-slate-300 shadow-lg backdrop-blur-md transition hover:text-white"
        >
          Data API
        </Link>
      </div>
    </div>
  );
}
