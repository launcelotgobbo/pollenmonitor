import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('@/components/Map/MapView'), { ssr: false });

export const metadata = { title: 'US Pollen Map' };

export default function MapPage() {
  return <MapView />;
}
