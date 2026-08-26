import { strict as assert } from 'node:assert';
import test from 'node:test';
import { buildMapFeatureCollection, type DailyCityRow } from '@/lib/mapData';

const coords: Record<string, [number, number]> = {
  denver: [-104.99, 39.74],
  austin: [-97.74, 30.27],
};

test('buildMapFeatureCollection builds one feature per city with a sorted series', () => {
  const rows: DailyCityRow[] = [
    {
      city_slug: 'denver',
      date: '2026-08-11',
      tree: 30,
      grass: 8,
      weed: 2,
      max_species_tree: 20,
      max_species_grass: 8,
      max_species_weed: 2,
      ragweed: 2,
      tz: 'America/Denver',
    },
    {
      city_slug: 'denver',
      date: '2026-08-10',
      tree: 12,
      grass: 5,
      weed: 1,
      max_species_tree: 8,
      max_species_grass: 5,
      max_species_weed: 1,
      ragweed: 1,
      tz: 'America/Denver',
    },
    {
      city_slug: 'austin',
      date: '2026-08-10',
      tree: 100,
      grass: 40,
      weed: 9,
      max_species_tree: 50,
      max_species_grass: 40,
      max_species_weed: 9,
      ragweed: 9,
      tz: 'America/Chicago',
    },
  ];

  const fc = buildMapFeatureCollection(rows, coords, '2026-08-10');
  assert.equal(fc.type, 'FeatureCollection');
  assert.equal(fc.features.length, 2);

  const denver = fc.features.find((f: any) => f.properties.city === 'denver') as any;
  assert.ok(denver);
  assert.deepEqual(denver.geometry.coordinates, coords.denver);
  // base day is the requested date, not the max of the window
  assert.equal(denver.properties.tree, 12);
  assert.equal(denver.properties.count, 12 + 5 + 1);
  assert.equal(denver.properties.risk_tree, 'Low');
  assert.equal(denver.properties.timezone, 'America/Denver');
  // series sorted ascending across the 3-day window
  assert.deepEqual(
    denver.properties.series.map((s: any) => s.date),
    ['2026-08-10', '2026-08-11'],
  );
});

test('buildMapFeatureCollection uses NAB risk based on the maximum species value', () => {
  const rows: DailyCityRow[] = [
    {
      city_slug: 'denver',
      date: '2026-08-10',
      tree: 100,
      grass: 40,
      weed: 55,
      max_species_tree: 40,
      max_species_grass: 8,
      max_species_weed: 35,
      ragweed: 35,
      tz: null,
    },
  ];

  const fc = buildMapFeatureCollection(rows, coords, '2026-08-10');
  const props = (fc.features[0] as any).properties;
  assert.equal(props.risk_tree, 'Moderate');
  assert.equal(props.risk_grass, 'Moderate');
  assert.equal(props.risk_weed, 'Moderate');
  assert.equal(props.ragweed, 35);
  assert.equal(props.risk_ragweed, 'Moderate');
  assert.equal(props.sev_tree, 2);
  assert.equal(props.sev_grass, 2);
  assert.equal(props.sev_weed, 2);
  assert.equal(props.sev_ragweed, 2);
  assert.equal(props.sev_total, 2);
});

test('buildMapFeatureCollection falls back to the first series day when the requested date is missing', () => {
  const rows: DailyCityRow[] = [
    {
      city_slug: 'austin',
      date: '2026-08-11',
      tree: 7,
      grass: 3,
      weed: 0,
      max_species_tree: null,
      max_species_grass: null,
      max_species_weed: null,
      ragweed: 0,
      tz: 'America/Chicago',
    },
  ];

  const fc = buildMapFeatureCollection(rows, coords, '2026-08-10');
  const props = (fc.features[0] as any).properties;
  assert.equal(props.tree, 7);
  assert.equal(props.count, 10);
  assert.equal(props.series.length, 1);
});

test('buildMapFeatureCollection uses [0,0] for unknown city coordinates', () => {
  const rows: DailyCityRow[] = [
    {
      city_slug: 'nowhere',
      date: '2026-08-10',
      tree: 1,
      grass: 1,
      weed: 1,
      max_species_tree: null,
      max_species_grass: null,
      max_species_weed: null,
      ragweed: 1,
      tz: null,
    },
  ];
  const fc = buildMapFeatureCollection(rows, coords, '2026-08-10');
  assert.deepEqual((fc.features[0] as any).geometry.coordinates, [0, 0]);
});

test('buildMapFeatureCollection uses weed as ragweed for pre-species rows', () => {
  const rows: DailyCityRow[] = [
    {
      city_slug: 'denver',
      date: '2026-08-10',
      tree: 1,
      grass: 1,
      weed: 60,
      max_species_tree: null,
      max_species_grass: null,
      max_species_weed: null,
      ragweed: null,
      tz: 'America/Denver',
    },
  ];

  const fc = buildMapFeatureCollection(rows, coords, '2026-08-10');
  const props = (fc.features[0] as any).properties;
  assert.equal(props.ragweed, 60);
  assert.equal(props.risk_ragweed, 'High');
  assert.equal(props.sev_ragweed, 3);
});
