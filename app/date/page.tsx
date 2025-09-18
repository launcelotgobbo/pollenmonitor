'use client';

import { useEffect, useMemo, useState } from 'react';

export default function DatePage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [date, setDate] = useState<string>(today);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/pollen?date=${encodeURIComponent(date)}`, {
          cache: 'no-store',
        });
        const json = await res.json();
        setData(json);
      } catch (e: any) {
        setError(e?.message ?? 'Failed to fetch');
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [date]);

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 600 }}>
      <h2>Lookup pollen by date</h2>
      <label>
        Date: <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {data && (
        <pre
          style={{
            background: '#f6f8fa',
            padding: 12,
            borderRadius: 6,
            overflowX: 'auto',
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

