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
      {data?.rows && data.rows.length > 0 && (
        <div style={{ fontSize: 12, color: '#616161' }}>
          {data.rows.some((r: any) => r.is_forecast) ? (
            <span style={{ padding: '2px 6px', background: '#e3f2fd', color: '#1565c0', borderRadius: 4 }}>
              Forecast data
            </span>
          ) : (
            <span style={{ padding: '2px 6px', background: '#e8f5e9', color: '#2e7d32', borderRadius: 4 }}>
              Actuals
            </span>
          )}
        </div>
      )}
      {data?.rows && data.rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f7f7f7' }}>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>City</th>
                <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #eee' }}>Count</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Source</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Type</th>
              </tr>
            </thead>
            <tbody>
              {[...data.rows]
                .sort((a: any, b: any) => (b.count ?? 0) - (a.count ?? 0))
                .map((row: any) => (
                  <tr key={row.city}>
                    <td style={{ padding: 8, borderBottom: '1px solid #f1f1f1' }}>
                      <a href={`/city/${encodeURIComponent(row.city)}`} style={{ color: '#1565c0', textDecoration: 'underline' }}>
                        {row.city}
                      </a>
                    </td>
                    <td style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #f1f1f1' }}>{row.count ?? '-'}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f1f1f1' }}>{row.source || '-'}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f1f1f1' }}>
                      {row.is_forecast ? (
                        <span style={{ padding: '2px 6px', background: '#e3f2fd', color: '#1565c0', borderRadius: 4 }}>
                          Forecast
                        </span>
                      ) : (
                        <span style={{ padding: '2px 6px', background: '#e8f5e9', color: '#2e7d32', borderRadius: 4 }}>
                          Actual
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
