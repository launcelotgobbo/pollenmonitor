'use client';

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DEFAULT_VIEW, getStyleUrl } from '@/lib/map';
import { useEffect, useRef } from 'react';

export default function MapCanvas() {
  const ref = useRef<HTMLDivElement | null>(null);

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

    const addOrUpdateSource = (geojson: any) => {
      const id = 'pollen';
      const existing = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
      if (existing && 'setData' in existing) {
        existing.setData(geojson);
        return;
      }
      map.addSource(id, {
        type: 'geojson',
        data: geojson,
        cluster: false,
      } as any);

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: id,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#90caf9',
            10,
            '#64b5f6',
            50,
            '#42a5f5',
            100,
            '#1e88e5',
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            16,
            10,
            20,
            50,
            24,
            100,
            28,
          ],
        },
      } as any);

      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: id,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': 12,
        },
        paint: { 'text-color': '#0d47a1' },
      } as any);

      map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: id,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'match',
            ['get', 'severity'],
            'low', '#4caf50',
            'moderate', '#ffb300',
            'high', '#fb8c00',
            'very_high', '#e53935',
            /* other */ '#9e9e9e',
          ],
          'circle-radius': 6,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        },
      } as any);

      // Hover popup on unclustered points
      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
      map.on('mousemove', 'unclustered-point', (e) => {
        const feature = (e.features && e.features[0]) as any;
        if (!feature) return;
        const coords = feature.geometry.coordinates.slice();
        const name = feature.properties?.name || 'City';
        const population = feature.properties?.population;
        const popText = population ? `<br/>Population: ${Number(population).toLocaleString()}` : '';
        popup
          .setLngLat(coords)
          .setHTML(`<div style="font-size:12px"><strong>${name}</strong>${popText}</div>`)
          .addTo(map);
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'unclustered-point', () => {
        popup.remove();
        map.getCanvas().style.cursor = '';
      });

      // Click to select and zoom
      map.on('click', 'unclustered-point', (e) => {
        const feature = e.features && e.features[0] as any;
        if (!feature) return;
        const coords = feature.geometry.coordinates.slice();
        map.easeTo({ center: coords, zoom: Math.max(map.getZoom(), 8) });
      });

      // Zoom into clusters on click
      map.on('click', 'clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        const feature = features[0] as any;
        const clusterId = feature?.properties?.cluster_id;
        const source = map.getSource(id) as any;
        if (!clusterId || !source) return;
        source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
          if (err) return;
          map.easeTo({ center: feature.geometry.coordinates, zoom });
        });
      });

      map.on('mouseenter', 'clusters', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'clusters', () => {
        map.getCanvas().style.cursor = '';
      });
    };

    map.on('load', () => {
      // Add US state boundaries overlay
      if (!map.getSource('us-states')) {
        map.addSource('us-states', {
          type: 'geojson',
          data: '/data/us-states.geojson',
        } as any);
      }
      if (!map.getLayer('us-state-borders')) {
        map.addLayer({
          id: 'us-state-borders',
          type: 'line',
          source: 'us-states',
          paint: {
            'line-color': '#9e9e9e',
            'line-opacity': 0.7,
            'line-width': 1.2,
          },
        } as any);
      }

      fetch('/data/us-top-40-cities.geojson')
        .then((r) => r.json())
        .then(addOrUpdateSource)
        .catch(() => {});
    });

    return () => {
      map.remove();
    };
  }, []);

  return (
    <div
      ref={ref}
      style={{ height: '70vh', width: '100%', borderRadius: 8, overflow: 'hidden' }}
    />
  );
}
