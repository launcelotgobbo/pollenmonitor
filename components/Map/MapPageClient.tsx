'use client';

import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('@/components/Map/MapView'), { ssr: false });

export default function MapPageClient() {
  return <MapView />;
}
