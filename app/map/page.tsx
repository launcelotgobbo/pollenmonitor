import dynamic from 'next/dynamic';
import Legend from '@/components/Map/Legend';

const MapCanvas = dynamic(() => import('@/components/Map/MapCanvas'), { ssr: false });

export const metadata = {
  title: 'US Pollen Map',
};

export default function MapPage() {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h2>US Pollen Map (sample data)</h2>
      <p style={{ color: '#616161' }}>
        This map shows sample markers and clustering. Configure a tiles style via
        NEXT_PUBLIC_MAP_STYLE_URL or NEXT_PUBLIC_MAPTILER_KEY for production.
      </p>
      <MapCanvas />
      <Legend />
    </div>
  );
}

