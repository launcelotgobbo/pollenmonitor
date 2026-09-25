'use client';

import { useEffect, useState } from 'react';
import type { HealthReport } from '@/lib/health';
import { describeFreshness, type Freshness, type FreshnessTone } from '@/lib/freshness';

const DOT: Record<FreshnessTone, string> = {
  ok: 'bg-emerald-400',
  warn: 'bg-amber-400',
  down: 'bg-rose-500',
};

const TEXT: Record<'light' | 'dark', string> = {
  light: 'text-slate-600 hover:text-slate-900',
  dark: 'text-slate-300 hover:text-white',
};

export default function DataFreshness({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  const [freshness, setFreshness] = useState<Freshness | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { cache: 'no-store', signal: controller.signal })
      // 503 still carries a full report; only a network failure hides the badge.
      .then((res) => res.json() as Promise<HealthReport>)
      .then((report) => setFreshness(describeFreshness(report)))
      .catch(() => setFreshness(null));
    return () => controller.abort();
  }, []);

  if (!freshness) return null;

  return (
    <a
      href="/api/health"
      title={freshness.detail}
      aria-label={`${freshness.label}: ${freshness.detail}`}
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium leading-4 transition sm:text-xs ${TEXT[theme]}`}
    >
      <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${DOT[freshness.tone]}`} />
      <span>{freshness.label}</span>
      <span className="hidden opacity-70 md:inline">· {freshness.detail}</span>
    </a>
  );
}
