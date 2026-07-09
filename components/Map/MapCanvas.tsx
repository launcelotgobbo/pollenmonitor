'use client';

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DEFAULT_VIEW, getStyleUrl } from '@/lib/map';
import { useEffect, useRef, useState } from 'react';
import { addStateBoundaries, upsertPollenData } from './pollenLayer';

export default function MapCanvas({ date }: { date: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const dateRef = useRef(date);

  useEffect(() => {
    dateRef.current = date;
  }, [date]);

  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: getStyleUrl(),
      center: [DEFAULT_VIEW.longitude, DEFAULT_VIEW.latitude],
      zoom: DEFAULT_VIEW.zoom,
      dragRotate: false,
      minZoom: 2.5,
      maxZoom: 10,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    map.on('load', () => {
      setMapLoaded(true);
      // Ensure correct sizing in case container dimensions changed pre-load
      try { map.resize(); } catch {}
      addStateBoundaries(map);
      // Data fetch is handled by the effect watching mapLoaded + date
    });

    const onResize = () => {
      try { map.resize(); } catch {}
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      map.remove();
    };
  }, []);

  // Update data when map is ready and/or date changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !date) return;
    const url = `/api/map-data?date=${encodeURIComponent(date)}&_=${Date.now()}`;
    fetch(url, { cache: 'no-store' })
      .then((r) => r.json())
      .then((geojson) => {
        upsertPollenData(map, geojson, () => dateRef.current);
      })
      .catch(() => {});
  }, [date, mapLoaded]);

  return (
    <div
      ref={ref}
      style={{ height: '100%', width: '100%', overflow: 'hidden' }}
    />
  );
}
