'use client';

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DEFAULT_VIEW, getStyleUrl } from '@/lib/map';
import { useEffect, useRef, useState } from 'react';

export default function MapCanvas({ date }: { date: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

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
            'case',
            ['==', ['get', 'is_forecast'], true], '#1976d2',
            '#2e7d32'
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
        const name = feature.properties?.city || 'City';
        const count = feature.properties?.count;
        const isForecast = !!feature.properties?.is_forecast;
        popup
          .setLngLat(coords)
          .setHTML(`<div style="font-size:12px"><strong>${name}</strong><br/>Count: ${count ?? '-'}${isForecast ? ' (forecast)' : ''}</div>`)
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
        const slug = feature.properties?.city;
        if (slug) window.location.href = `/city/${encodeURIComponent(slug)}`;
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
      setMapLoaded(true);
      // Ensure correct sizing in case container dimensions changed pre-load
      try { map.resize(); } catch {}
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
      // no initial fetch here; handled by effect watching mapLoaded + date
    });

    // Keep map sized correctly on viewport changes
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
        const id = 'pollen';
        const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
        if (src && 'setData' in src) {
          src.setData(geojson as any);
          return;
        }
        // Source/layers not created yet — create now
        if (!map.getSource(id)) {
          map.addSource(id, { type: 'geojson', data: geojson, cluster: false } as any);
        }
        if (!map.getLayer('unclustered-point')) {
          map.addLayer({
            id: 'unclustered-point',
            type: 'circle',
            source: id,
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-color': [
                'case',
                ['==', ['get', 'is_forecast'], true], '#1976d2',
                '#2e7d32',
              ],
              'circle-radius': 6,
              'circle-stroke-width': 1,
              'circle-stroke-color': '#ffffff',
            },
          } as any);

          const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
          map.on('mousemove', 'unclustered-point', (e) => {
            const feature = (e.features && e.features[0]) as any;
            if (!feature) return;
            const coords = feature.geometry.coordinates.slice();
            const name = feature.properties?.city || 'City';
            const count = feature.properties?.count;
            const isForecast = !!feature.properties?.is_forecast;
            const tree = feature.properties?.tree;
            const grass = feature.properties?.grass;
            const weed = feature.properties?.weed;
            const series = feature.properties?.series as Array<any> | null | undefined;
            const rows = Array.isArray(series) && series.length
              ? series
              : [{ date, tree: feature.properties?.tree, grass: feature.properties?.grass, weed: feature.properties?.weed }];
            const tableHtml = rows.length
              ? `<table style="font-size:12px; border-collapse:collapse; margin-top:4px;">`
                + `<thead><tr><th style="text-align:left;padding:2px 6px;">Date</th><th style="text-align:right;padding:2px 6px;">Tree</th><th style="text-align:right;padding:2px 6px;">Grass</th><th style="text-align:right;padding:2px 6px;">Weed</th></tr></thead>`
                + `<tbody>`
                + rows.map((r: any, idx: number) => {
                    const color = idx === 0 ? '#212121' : '#9e9e9e';
                    return `<tr>`
                      + `<td style="padding:2px 6px;color:${color}">${r.date}</td>`
                      + `<td style="padding:2px 6px;text-align:right;color:${color}">${r.tree ?? '-'}</td>`
                      + `<td style="padding:2px 6px;text-align:right;color:${color}">${r.grass ?? '-'}</td>`
                      + `<td style="padding:2px 6px;text-align:right;color:${color}">${r.weed ?? '-'}</td>`
                      + `</tr>`;
                  }).join('')
                + `</tbody></table>`
              : '';
            popup
              .setLngLat(coords)
              .setHTML(`<div style="font-size:12px"><strong>${name}</strong>${tableHtml}</div>`)
              .addTo(map);
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', 'unclustered-point', () => {
            map.getCanvas().style.cursor = '';
          });
          map.on('click', 'unclustered-point', (e) => {
            const feature = (e.features && e.features[0]) as any;
            if (!feature) return;
            const slug = feature.properties?.city;
            if (slug) window.location.href = `/city/${encodeURIComponent(slug)}`;
          });
        }
      })
      .catch(() => {});
  }, [date, mapLoaded]);

  return (
    <div
      ref={ref}
      style={{ height: '100vh', width: '100%', overflow: 'hidden' }}
    />
  );
}
