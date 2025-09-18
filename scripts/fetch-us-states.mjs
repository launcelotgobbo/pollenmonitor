// Download a simple US states GeoJSON and save under public/data
// Usage: node scripts/fetch-us-states.mjs
import fs from 'node:fs/promises';

const URL = 'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json';

async function main() {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`Failed to download US states: ${res.status}`);
  const json = await res.json();
  await fs.mkdir('public/data', { recursive: true });
  await fs.writeFile('public/data/us-states.geojson', JSON.stringify(json));
  console.log('Wrote public/data/us-states.geojson');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

