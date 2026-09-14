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

function PollenTypeOptions({
  value,
  onSelect,
  className,
  optionClassName,
  id,
}: {
  value: PollenType;
  onSelect: (value: PollenType) => void;
  className: string;
  optionClassName: string;
  id?: string;
}) {
  return (
    <div id={id} role="radiogroup" aria-label="Pollen category" className={className}>
      {POLLEN_TYPES.map((type) => (
        <button
          key={type.value}
          type="button"
          role="radio"
          aria-checked={value === type.value}
          onClick={() => onSelect(type.value)}
          className={`${optionClassName} rounded-xl text-sm font-semibold transition ${
            value === type.value
              ? 'bg-sky-500 text-white shadow-sm'
              : 'text-slate-300 hover:bg-white/5 hover:text-white'
          }`}
        >
          {type.label}
        </button>
      ))}
    </div>
  );
}

export default function MapView() {
  const [pollenType, setPollenType] = useState<PollenType>('total');
  const [resolvedDate, setResolvedDate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const selectedLabel =
    POLLEN_TYPES.find((type) => type.value === pollenType)?.label ?? 'Pollen layer';

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-slate-950">
      <MapCanvas
        date=""
        pollenType={pollenType}
        onDateResolved={setResolvedDate}
        onError={() => setError('Map data is unavailable.')}
      />

      <div className="pointer-events-none absolute left-3 top-3 z-10 sm:left-5 sm:top-5">
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/90 px-3 py-2.5 text-slate-50 shadow-2xl backdrop-blur-md sm:px-4">
          <Link href="/" className="shrink-0 text-sm font-bold tracking-tight">
            Pollen Monitor
          </Link>
          <div className="border-l border-white/10 pl-3 text-[10px] leading-4 text-slate-400">
            <p>{resolvedDate || 'Latest data'}</p>
            <p>Daily peak</p>
          </div>
          <Link
            href="/docs/api"
            className="hidden border-l border-white/10 pl-3 text-[11px] font-semibold text-slate-300 transition hover:text-white sm:block"
          >
            Data API
          </Link>
        </div>
        {error ? (
          <p className="pointer-events-auto mt-2 w-fit rounded-full bg-rose-950/90 px-3 py-1 text-xs text-rose-100">
            {error}
          </p>
        ) : null}
      </div>

      <div
        className={`pointer-events-none absolute bottom-[4.75rem] left-3 z-10 sm:bottom-20 sm:left-5 ${
          mobileMenuOpen ? 'hidden sm:block' : ''
        }`}
      >
        <div className="pointer-events-auto">
          <Legend />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 hidden px-5 sm:block">
        <PollenTypeOptions
          value={pollenType}
          onSelect={setPollenType}
          className="pointer-events-auto mx-auto grid h-12 w-full max-w-xl grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-slate-950/90 p-1.5 text-slate-50 shadow-2xl backdrop-blur-md"
          optionClassName="min-w-0 px-3 text-center"
        />
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 z-20 sm:hidden">
        <div className="pointer-events-auto flex flex-col-reverse items-start">
          <button
            type="button"
            aria-label={`Choose pollen category. Current: ${selectedLabel}`}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-pollen-layers"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="inline-flex h-12 items-center gap-2 rounded-full border border-white/10 bg-slate-950/95 px-4 text-sm font-semibold text-white shadow-2xl backdrop-blur-md"
          >
            <span aria-hidden className="relative block h-4 w-4">
              <span
                className={`absolute left-0 top-0.5 h-0.5 w-4 bg-current transition ${
                  mobileMenuOpen ? 'translate-y-[5px] rotate-45' : ''
                }`}
              />
              <span
                className={`absolute left-0 top-[7px] h-0.5 w-4 bg-current transition ${
                  mobileMenuOpen ? 'opacity-0' : ''
                }`}
              />
              <span
                className={`absolute bottom-0.5 left-0 h-0.5 w-4 bg-current transition ${
                  mobileMenuOpen ? '-translate-y-[5px] -rotate-45' : ''
                }`}
              />
            </span>
            {selectedLabel}
          </button>
          <PollenTypeOptions
            id="mobile-pollen-layers"
            value={pollenType}
            onSelect={(value) => {
              setPollenType(value);
              setMobileMenuOpen(false);
            }}
            className={`mb-2 w-44 gap-1 rounded-2xl border border-white/10 bg-slate-950/95 p-1.5 text-slate-50 shadow-2xl backdrop-blur-md ${
              mobileMenuOpen ? 'grid' : 'hidden'
            }`}
            optionClassName="px-3 py-2 text-left"
          />
        </div>
      </div>
    </div>
  );
}
