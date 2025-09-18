'use client';

import { useEffect, useMemo, useState } from 'react';

type City = { name: string; slug: string };

export default function PollenPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [city, setCity] = useState<string>('new-york-city');
  const [date, setDate] = useState<string>('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/data/us-top-40-cities.geojson')
      .then((r) => r.json())
      .then((fc) => {
        const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const list = fc.features.map((f: any) => ({ name: f.properties.name as string, slug: toSlug(f.properties.name) }));
        setCities(list);
        if (list.length) setCity(list[0].slug);
      });
  }, []);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    if (!city) return;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    qs.set('city', city);
    if (date) qs.set('date', date);
    fetch(`/api/google-pollen?${qs.toString()}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [city, date]);

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 900 }}>
      <h2>Google Pollen (Forecast)</h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>
          City:
          <select value={city} onChange={(e) => setCity(e.target.value)} style={{ marginLeft: 8 }}>
            {cities.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          Date:
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ marginLeft: 8 }} placeholder={today} />
        </label>
        <button onClick={() => setDate('')}>Today</button>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {data && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ padding: 12, border: '1px solid #eee', borderRadius: 6 }}>
              <div>Grass Index</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{data.summary?.grass_index ?? '-'}</div>
            </div>
            <div style={{ padding: 12, border: '1px solid #eee', borderRadius: 6 }}>
              <div>Tree Index</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{data.summary?.tree_index ?? '-'}</div>
            </div>
            <div style={{ padding: 12, border: '1px solid #eee', borderRadius: 6 }}>
              <div>Weed Index</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{data.summary?.weed_index ?? '-'}</div>
            </div>
          </div>

          <div>
            <h3>Plants</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: 600, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Name</th>
                    <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Type</th>
                    <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Index</th>
                    <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Category</th>
                    <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>In Season</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.plants || []).map((p: any, i: number) => (
                    <tr key={i}>
                      <td style={{ padding: 8, borderBottom: '1px solid #f3f3f3' }}>{p.displayName || p.code}</td>
                      <td style={{ padding: 8, borderBottom: '1px solid #f3f3f3' }}>{p.type || '-'}</td>
                      <td style={{ padding: 8, borderBottom: '1px solid #f3f3f3' }}>{p.index ?? '-'}</td>
                      <td style={{ padding: 8, borderBottom: '1px solid #f3f3f3' }}>{p.category || '-'}</td>
                      <td style={{ padding: 8, borderBottom: '1px solid #f3f3f3' }}>{p.inSeason ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

