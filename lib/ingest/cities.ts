export type City = { name: string; slug: string; lat: number; lon: number };

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export async function loadTopCities(): Promise<City[]> {
  try {
    const fs = await import('node:fs/promises');
    const buf = await fs.readFile('public/data/us-top-40-cities.geojson', 'utf-8');
    const fc = JSON.parse(buf);
    return fc.features.map((f: any) => ({
      name: f.properties.name as string,
      slug: slugify(f.properties.name as string),
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    }));
  } catch {
    return [];
  }
}
