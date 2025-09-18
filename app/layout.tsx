import type { Metadata } from 'next';
import React from 'react';
import { Analytics } from '@vercel/analytics/next';

export const metadata: Metadata = {
  title: 'Pollen Monitor',
  description: 'Check pollen counts by date or city history',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: 24 }}>
        <header style={{ marginBottom: 24 }}>
          <a href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1 style={{ margin: 0 }}>Pollen Monitor</h1>
          </a>
        </header>
        <main>{children}</main>
        <Analytics />
      </body>
    </html>
  );
}
