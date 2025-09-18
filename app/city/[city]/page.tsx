import { notFound } from 'next/navigation';
import CityPicker from '@/components/CityPicker';
import Link from 'next/link';

type Props = { params: { city: string } };

export const revalidate = 3600; // cache city history for 1 hour

export default async function CityPage({ params }: Props) {
  const city = decodeURIComponent(params.city || '').trim();
  if (!city) notFound();

  const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const url = new URL(`${base}/api/city-type-matrix`);
  url.searchParams.set('city', city);
  url.searchParams.set('days', '60');
  const res = await fetch(url.toString(), { next: { revalidate } });
  const data = await res.json();

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 800 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Historical pollen</h2>
        <Link href="/map" style={{ color: '#1565c0', textDecoration: 'underline' }}>← Back to map</Link>
      </div>
      <div>
        <CityPicker current={city} />
      </div>
      <p>Showing historical time series.</p>
      {Array.isArray(data?.rows) && data.rows.length > 0 && (
        <div style={{ fontSize: 12, color: '#616161' }}>
          {data.rows.some((r: any) => r.is_forecast) ? (
            <span style={{ padding: '2px 6px', background: '#e3f2fd', color: '#1565c0', borderRadius: 4 }}>
              Includes forecast
            </span>
          ) : (
            <span style={{ padding: '2px 6px', background: '#e8f5e9', color: '#2e7d32', borderRadius: 4 }}>
              Actuals only
            </span>
          )}
        </div>
      )}
      {Array.isArray(data?.rows) && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f7f7f7' }}>
                <th rowSpan={2} style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Date</th>
                <th colSpan={3} style={{ textAlign: 'center', padding: 8, borderBottom: '1px solid #eee' }}>Date + 0</th>
                <th colSpan={3} style={{ textAlign: 'center', padding: 8, borderBottom: '1px solid #eee' }}>Date + 1</th>
                <th colSpan={3} style={{ textAlign: 'center', padding: 8, borderBottom: '1px solid #eee' }}>Date + 2</th>
              </tr>
              <tr style={{ background: '#f7f7f7' }}>
                <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #eee' }}>Tree</th>
                <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #eee' }}>Grass</th>
                <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #eee' }}>Weed</th>
                <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #eee', color: '#9e9e9e' }}>Tree</th>
                <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #eee', color: '#9e9e9e' }}>Grass</th>
                <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #eee', color: '#9e9e9e' }}>Weed</th>
                <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #eee', color: '#9e9e9e' }}>Tree</th>
                <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #eee', color: '#9e9e9e' }}>Grass</th>
                <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #eee', color: '#9e9e9e' }}>Weed</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row: any) => (
                <tr key={row.date}>
                  <td style={{ padding: 8, borderBottom: '1px solid #f1f1f1' }}>{row.date}</td>
                  <td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #f1f1f1' }}>{row.day0?.tree ?? '-'}</td>
                  <td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #f1f1f1' }}>{row.day0?.grass ?? '-'}</td>
                  <td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #f1f1f1' }}>{row.day0?.weed ?? '-'}</td>
                  <td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #f1f1f1', color: '#9e9e9e' }}>{row.day1?.tree ?? '-'}</td>
                  <td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #f1f1f1', color: '#9e9e9e' }}>{row.day1?.grass ?? '-'}</td>
                  <td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #f1f1f1', color: '#9e9e9e' }}>{row.day1?.weed ?? '-'}</td>
                  <td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #f1f1f1', color: '#9e9e9e' }}>{row.day2?.tree ?? '-'}</td>
                  <td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #f1f1f1', color: '#9e9e9e' }}>{row.day2?.grass ?? '-'}</td>
                  <td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #f1f1f1', color: '#9e9e9e' }}>{row.day2?.weed ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
