export const US_BOUNDS: [[number, number], [number, number]] = [
  [-125.0011, 24.9493], // Southwest (lon, lat)
  [-66.9326, 49.5904], // Northeast (lon, lat)
];

export const DEFAULT_VIEW = {
  longitude: -98.583, // center of contiguous US
  latitude: 39.833,
  zoom: 3.5,
};

export const SEVERITY_COLORS: Record<string, string> = {
  low: '#4caf50',
  moderate: '#ffb300',
  high: '#fb8c00',
  very_high: '#e53935',
};

export function getStyleUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL;
  const mapTilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (envUrl) return envUrl;
  if (mapTilerKey) {
    return '/api/map-style';
  }
  // Local raster/vector fallback (dev only)
  return '/map-style.json';
}
