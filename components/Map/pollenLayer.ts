import maplibregl from 'maplibre-gl';
import { buildPopupHtml } from './popup';

export const POLLEN_SOURCE_ID = 'pollen';
export const POLLEN_LAYER_ID = 'unclustered-point';

// Thresholds and colors match the severity buckets shown in Legend.tsx
const SEVERITY_STEP_PAINT = [
  'step',
  ['get', 'max_weed'],
  '#4caf50',
  25, '#ffb300',
  75, '#fb8c00',
  125, '#e53935',
];

export function upsertPollenData(map: maplibregl.Map, geojson: any, getDate: () => string) {
  const existing = map.getSource(POLLEN_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  if (existing && 'setData' in existing) {
    existing.setData(geojson);
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
      'circle-color': SEVERITY_STEP_PAINT,
      'circle-radius': 6,
      'circle-stroke-width': 1,
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
