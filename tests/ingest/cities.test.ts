import { strict as assert } from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { loadTopCities, parseFeatureCollection } from '@/lib/ingest/cities';

function feature(name: string, coordinates: [number, number], slug?: string) {
  return {
    type: 'Feature',
    properties: slug ? { name, slug } : { name },
    geometry: { type: 'Point', coordinates },
  };
}

test('parseFeatureCollection honours explicit slugs and drops duplicate slugs', () => {
  const originalWarn = console.warn;
  const warnings: unknown[] = [];
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };
  try {
    const cities = parseFeatureCollection({
      type: 'FeatureCollection',
      features: [
        feature('Columbus, OH', [-83.0, 39.96], 'columbus'),
        feature('Columbus, GA', [-84.94, 32.49], 'columbus-ga'),
        feature('Springfield', [-93.29, 37.2]),
        feature('Springfield', [-72.55, 42.11]),
        feature('New York City', [-74.0, 40.71]),
      ],
    });

    assert.deepEqual(
      cities.map((c) => c.slug),
      ['columbus', 'columbus-ga', 'springfield', 'new-york-city'],
    );
    assert.equal(cities[2].lat, 37.2, 'the first feature wins a slug collision');
    assert.equal(warnings.length, 1);
  } finally {
    console.warn = originalWarn;
  }
});

test('the bundled city seed has unique slugs and excludes retired cities', async () => {
  const raw = await fs.readFile(
    path.join(process.cwd(), 'public', 'data', 'us-top-175-cities.geojson'),
    'utf-8',
  );
  const collection = JSON.parse(raw);
  const cities = parseFeatureCollection(collection);

  assert.equal(cities.length, collection.features.length, 'no feature should be dropped');
  assert.equal(new Set(cities.map((c) => c.slug)).size, cities.length);
  assert.equal(cities.some((c) => c.slug === 'honolulu'), false);

  const bySlug = new Map(cities.map((c) => [c.slug, c]));
  for (const [slug, name] of [
    ['columbus', 'Columbus, OH'],
    ['columbus-ga', 'Columbus, GA'],
    ['kansas-city', 'Kansas City, MO'],
    ['kansas-city-ks', 'Kansas City, KS'],
    ['arlington', 'Arlington, TX'],
    ['arlington-va', 'Arlington, VA'],
    ['aurora', 'Aurora, CO'],
    ['aurora-il', 'Aurora, IL'],
    ['glendale', 'Glendale, AZ'],
    ['glendale-ca', 'Glendale, CA'],
    ['springfield', 'Springfield, MO'],
    ['springfield-ma', 'Springfield, MA'],
    ['virginia-beach', 'Virginia Beach'],
  ]) {
    assert.equal(bySlug.get(slug)?.name, name, slug);
  }

  const loaded = await loadTopCities();
  assert.equal(loaded.length, cities.length);
});
