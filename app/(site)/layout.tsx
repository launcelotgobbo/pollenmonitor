import type { ReactNode } from 'react';
import Link from 'next/link';

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-16 pt-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="text-2xl font-bold tracking-tight text-slate-900">
          Pollen Monitor
        </Link>
        <span className="text-sm font-medium text-slate-500">Hourly pollen insights</span>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
