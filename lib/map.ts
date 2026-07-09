export const DEFAULT_VIEW = {
  longitude: -98.583, // center of contiguous US
  latitude: 39.833,
  zoom: 3.5,
};

export function getStyleUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL;
  if (envUrl) return envUrl;
  // Serve the bundled style directly from /public to avoid runtime fetch failures.
  return '/map-style.json';
}
