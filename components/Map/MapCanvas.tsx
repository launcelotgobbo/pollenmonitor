'use client';

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DEFAULT_VIEW, getStyleUrl } from '@/lib/map';
import { useEffect, useRef, useState } from 'react';
import { addStateBoundaries, setPollenTypePaint, upsertPollenData, type PollenType } from './pollenLayer';

export default function MapCanvas({
  date,
  pollenType = 'total',
  onDateResolved,
}: {
  date: string;
  pollenType?: PollenType;
  onDateResolved?: (date: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const dateRef = useRef(date);
  const typeRef = useRef(pollenType);
  const lastFetchedDateRef = useRef<string | null>(null);
  const onDateResolvedRef = useRef(onDateResolved);

  useEffect(() => {
    onDateResolvedRef.current = onDateResolved;
  }, [onDateResolved]);

  useEffect(() => {
    dateRef.current = date;
  }, [date]);

  useEffect(() => {
    typeRef.current = pollenType;
    const map = mapRef.current;
    if (map && mapLoaded) setPollenTypePaint(map, pollenType);
  }, [pollenType, mapLoaded]);

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

  // Update data when map is ready and/or date changes. An empty date means
  // "latest": the server resolves it, so the first render doesn't wait on the
  // available-dates list.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    // Skip the refetch triggered by the parent adopting the resolved date.
    if (date && lastFetchedDateRef.current === date) return;
    const target = date || 'latest';
    fetch(`/api/map-data?date=${encodeURIComponent(target)}`)
      .then((r) => r.json())
      .then((geojson) => {
        const resolved: string = geojson?.date || date;
        lastFetchedDateRef.current = resolved || null;
        if (resolved && !dateRef.current) dateRef.current = resolved;
        upsertPollenData(map, geojson, () => dateRef.current, typeRef.current);
        if (!date && resolved) onDateResolvedRef.current?.(resolved);
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
