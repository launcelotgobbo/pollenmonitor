'use client';

import { useEffect, useState } from 'react';
import MapCanvas from '@/components/Map/MapCanvas';

export default function MapView() {
  const [date, setDate] = useState<string>('');
  const [dates, setDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError(null);
      try {
        const [latestRes, listRes] = await Promise.all([
          fetch('/api/latest-date', { cache: 'no-store' }),
          fetch('/api/available-dates', { cache: 'no-store' }),
        ]);
        const latest = await latestRes.json();
        const list = await listRes.json();
        const all: string[] = Array.isArray(list?.dates) ? list.dates : [];
        const today = new Date().toISOString().slice(0, 10);
        const ds = all.filter((d) => d <= today);
        setDates(ds);
        const preferred = ds.find((d) => d === latest?.date) || ds[0] || '';
        setDate(preferred);
      } catch (e: any) {
        setError(e?.message || 'Failed to load latest date');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw' }}>
      <MapCanvas date={date} />
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255,255,255,0.95)',
          border: '1px solid #e0e0e0',
          borderRadius: 8,
          padding: '8px 12px',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <label style={{ fontSize: 14, color: '#424242' }}>
          Date:{' '}
          <select
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ padding: '4px 6px' }}
          >
            {dates.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <span style={{ fontSize: 12, color: '#616161' }}>
          Hover a city for count • Click to open details
        </span>
      </div>
    </div>
  );
}
