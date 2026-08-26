import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { SITE_URL } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Pollen Monitor',
    template: '%s | Pollen Monitor',
  },
  description: 'Check modeled tree, grass, and ragweed pollen counts, risks, history, and forecasts across US cities.',
  applicationName: 'Pollen Monitor',
  openGraph: {
    type: 'website',
    siteName: 'Pollen Monitor',
    title: 'Pollen Monitor',
    description: 'City pollen counts, species breakdowns, NAB risk levels, and 48-hour forecasts.',
    url: '/',
  },
  twitter: {
    card: 'summary',
    title: 'Pollen Monitor',
    description: 'City pollen counts, species breakdowns, NAB risk levels, and 48-hour forecasts.',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="service-desc" type="application/vnd.oai.openapi+json" href="/openapi.json" />
        <link rel="alternate" type="text/plain" href="/llms.txt" title="Pollen Monitor agent guide" />
      </head>
      <body className="min-h-screen bg-slate-50">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
