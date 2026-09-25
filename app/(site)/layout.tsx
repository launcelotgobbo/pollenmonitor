import type { ReactNode } from 'react';
import Link from 'next/link';
import DataFreshness from '@/components/DataFreshness';

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-10 pt-6 sm:px-6 sm:pb-16 sm:pt-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:mb-8">
        <Link href="/" className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          Pollen Monitor
        </Link>
        <div className="flex items-center gap-3">
          <DataFreshness />
          <span className="text-xs font-medium text-slate-500 sm:text-sm">Daily pollen insights</span>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
