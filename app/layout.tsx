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
  description:
    'Check modeled daily tree, grass, and ragweed pollen averages, peaks, and risks across US cities.',
  applicationName: 'Pollen Monitor',
  openGraph: {
    type: 'website',
    siteName: 'Pollen Monitor',
    title: 'Pollen Monitor',
    description: 'Daily city pollen averages, peaks, species breakdowns, and NAB risk levels.',
    url: '/',
  },
  twitter: {
    card: 'summary',
    title: 'Pollen Monitor',
    description: 'Daily city pollen averages, peaks, species breakdowns, and NAB risk levels.',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="service-desc" type="application/vnd.oai.openapi+json" href="/openapi.json" />
        <link
          rel="alternate"
          type="text/plain"
          href="/llms.txt"
          title="Pollen Monitor agent guide"
        />
      </head>
      <body className="min-h-screen bg-slate-50">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
