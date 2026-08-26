import maplibregl from 'maplibre-gl';
import { buildPopupHtml } from './popup';

export const POLLEN_SOURCE_ID = 'pollen';
export const POLLEN_LAYER_ID = 'unclustered-point';

export type PollenType = 'total' | 'tree' | 'grass' | 'ragweed';

// NAB risk scores (see lib/risk.ts); colors match Legend.tsx.
// Score < 0 means no risk data for the selected type.
export function severityPaint(type: PollenType) {
  return [
    'step',
    ['coalesce', ['get', `sev_${type}`], -1],
    '#9e9e9e',
    0, '#4caf50',
    2, '#ffb300',
    3, '#fb8c00',
    4, '#e53935',
  ];
}

export function setPollenTypePaint(map: maplibregl.Map, type: PollenType) {
  if (map.getLayer(POLLEN_LAYER_ID)) {
    map.setPaintProperty(POLLEN_LAYER_ID, 'circle-color', severityPaint(type) as any);
  }
}

export function upsertPollenData(
  map: maplibregl.Map,
  geojson: any,
  getDate: () => string,
  type: PollenType = 'total',
) {
  const existing = map.getSource(POLLEN_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  if (existing && 'setData' in existing) {
    existing.setData(geojson);
    setPollenTypePaint(map, type);
    return;
  }

  map.addSource(POLLEN_SOURCE_ID, {
    type: 'geojson',
    data: geojson,
    cluster: false,
  } as any);

  map.addLayer({
    id: POLLEN_LAYER_ID,
    type: 'circle',
    source: POLLEN_SOURCE_ID,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': severityPaint(type),
      // Grow with zoom, but sub-proportionally (a proportional fit would
      // double the radius per zoom level); zoom range is clamped to 2.5-10
      // in MapCanvas.
      'circle-radius': [
        'interpolate', ['exponential', 1.3], ['zoom'],
        2.5, 4.5,
        4, 6,
        6, 9,
        8, 13,
        10, 18,
      ],
      'circle-stroke-width': [
        'interpolate', ['linear'], ['zoom'],
        2.5, 1,
        10, 2,
      ],
      'circle-stroke-color': '#ffffff',
    },
  } as any);

  const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
  map.on('mousemove', POLLEN_LAYER_ID, (e) => {
    const feature = (e.features && e.features[0]) as any;
    if (!feature) return;
    const coords = feature.geometry.coordinates.slice();
    popup
      .setLngLat(coords)
      .setHTML(buildPopupHtml(feature, getDate()))
      .addTo(map);
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', POLLEN_LAYER_ID, () => {
    popup.remove();
    map.getCanvas().style.cursor = '';
  });
  map.on('click', POLLEN_LAYER_ID, (e) => {
    const feature = (e.features && e.features[0]) as any;
    if (!feature) return;
    const slug = feature.properties?.city;
    if (slug) window.location.href = `/city/${encodeURIComponent(slug)}?date=${encodeURIComponent(getDate())}`;
  });
}

export function addStateBoundaries(map: maplibregl.Map) {
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
}
