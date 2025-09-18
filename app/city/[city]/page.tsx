import { notFound } from 'next/navigation';

type Props = { params: { city: string } };

export const revalidate = 3600; // cache city history for 1 hour

export default async function CityPage({ params }: Props) {
  const city = decodeURIComponent(params.city || '').trim();
  if (!city) notFound();

  const url = new URL(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/pollen`);
  url.searchParams.set('city', city);

  const res = await fetch(url.toString(), { next: { revalidate } });
  const data = await res.json();

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 800 }}>
      <h2>Historical pollen for {city}</h2>
      <p>Showing historical time series.</p>
      <pre
        style={{ background: '#f6f8fa', padding: 12, borderRadius: 6, overflowX: 'auto' }}
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

