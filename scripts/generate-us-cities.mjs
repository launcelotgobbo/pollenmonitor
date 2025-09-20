// Fetch top N US cities by population from Wikidata and emit GeoJSON
// Usage: node scripts/generate-us-cities.mjs [limit]
import fs from 'node:fs/promises';

const endpoint = 'https://query.wikidata.org/sparql';
const limitArg = Number(process.argv[2]);
const LIMIT = Number.isFinite(limitArg) && limitArg > 0 ? Math.min(limitArg, 500) : 175;

const query = `
SELECT ?city ?cityLabel (MAX(?pop) as ?population) ?coord WHERE {
  ?city wdt:P31/wdt:P279* wd:Q515;  # city or subclasses
        wdt:P17 wd:Q30;          # country USA
        wdt:P1082 ?pop;          # population
        wdt:P625 ?coord.         # coordinates
  FILTER(?pop > 0)
  FILTER NOT EXISTS { ?city wdt:P31/wdt:P279* wd:Q1637706 } # exclude metropolitan areas
  FILTER NOT EXISTS { ?city wdt:P31/wdt:P279* wd:Q131593 }  # exclude urban areas
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?city ?cityLabel ?coord
ORDER BY DESC(?population)
LIMIT ${LIMIT}`;

async function main() {
  const url = `${endpoint}?format=json&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'PollenMonitor/0.1 (GitHub repo script)' } });
  if (!res.ok) {
    throw new Error(`SPARQL request failed: ${res.status}`);
  }
  const json = await res.json();
  const rows = json.results.bindings;

  const features = rows.map((r) => {
    const id = r.city.value; // full URI
    const name = r.cityLabel.value;
    const population = Number(r.population.value);
    const coordText = r.coord.value; // e.g., "Point(-74.006 40.7128)"
    const match = /Point\(([-0-9.]+) ([-0-9.]+)\)/.exec(coordText);
    if (!match) return null;
    const lon = Number(match[1]);
    const lat = Number(match[2]);
    return {
      type: 'Feature',
      properties: { name, population, wikidata: id },
      geometry: { type: 'Point', coordinates: [lon, lat] },
    };
  }).filter(Boolean);

  // Ensure certain cities are present even if not in top-40 by population
  const required = [
    { name: 'Berkeley', coordinates: [-122.2727, 37.8716] },
    { name: 'San Diego', coordinates: [-117.1611, 32.7157] },
    { name: 'Miami', coordinates: [-80.1918, 25.7617] },
  ];
  const existing = new Set(features.map((f) => f.properties.name.toLowerCase()));
  for (const city of required) {
    if (!existing.has(city.name.toLowerCase())) {
      features.push({
        type: 'Feature',
        properties: { name: city.name, population: null, wikidata: null },
        geometry: { type: 'Point', coordinates: city.coordinates },
      });
    }
  }

  const fc = { type: 'FeatureCollection', features };
  await fs.mkdir('public/data', { recursive: true });
  const filename = `public/data/us-top-${LIMIT}-cities.geojson`;
  await fs.writeFile(filename, JSON.stringify(fc, null, 2));
  console.log(`Wrote ${filename} with`, features.length, 'features');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
