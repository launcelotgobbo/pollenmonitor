import { notFound } from 'next/navigation';
import CityPicker from '@/components/CityPicker';
import Link from 'next/link';

type Props = { params: { city: string }; searchParams?: Record<string, string> };

export const revalidate = 3600; // cache city history for 1 hour

export default async function CityPage({ params, searchParams }: Props) {
  const city = decodeURIComponent(params.city || '').trim();
  if (!city) notFound();

  const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  // Load available dates
  const datesRes = await fetch(`${base}/api/available-dates`, { next: { revalidate } });
  const datesJson = await datesRes.json();
  const dates: string[] = Array.isArray(datesJson?.dates) ? datesJson.dates : [];
  const selected = searchParams?.date && dates.includes(searchParams.date) ? searchParams.date : dates[0];
  // Load hourly data for selected date
  const hourlyUrl = new URL(`${base}/api/pollen`);
  hourlyUrl.searchParams.set('city', city);
  if (selected) hourlyUrl.searchParams.set('date', selected);
  const res = await fetch(hourlyUrl.toString(), { next: { revalidate } });
  const data = await res.json();

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 800 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Hourly pollen</h2>
        <Link href="/map" style={{ color: '#1565c0', textDecoration: 'underline' }}>← Back to map</Link>
      </div>
      <div>
        <CityPicker current={city} />
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <form action={`/city/${encodeURIComponent(city)}`} method="get" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 14, color: '#424242' }}>
            Date:
            <select name="date" defaultValue={selected || ''} style={{ marginLeft: 8 }}>
              {dates.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          <button type="submit" style={{ padding: '4px 8px' }}>View</button>
        </form>
      </div>
      {Array.isArray(data?.rows) && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f7f7f7' }}>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Time (UTC)</th>
                <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #eee' }}>Tree</th>
                <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #eee' }}>Grass</th>
                <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #eee' }}>Weed</th>
                <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #eee' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row: any) => (
                <tr key={row.ts}>
                  <td style={{ padding: 8, borderBottom: '1px solid #f1f1f1' }}>{new Date(row.ts).toISOString().slice(11, 16)}</td>
                  <td style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #f1f1f1' }}>{row.tree ?? '-'}</td>
                  <td style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #f1f1f1' }}>{row.grass ?? '-'}</td>
                  <td style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #f1f1f1' }}>{row.weed ?? '-'}</td>
                  <td style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #f1f1f1' }}>{row.total ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
