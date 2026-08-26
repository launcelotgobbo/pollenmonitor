import { strict as assert } from 'node:assert';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/pollen/route';
import { GET as listCities } from '@/app/api/cities/route';
import { toDailyPollenRows } from '@/lib/pollen';

test('city discovery and pollen validation use the same supported city source', async () => {
  const response = await listCities(new NextRequest('http://localhost/api/cities'));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.ok(body.cities.some((city: any) => city.slug === 'seattle'));
  assert.deepEqual(
    body.cities.map((city: any) => city.name),
    body.cities.map((city: any) => city.name).sort((a: string, b: string) =>
      a.localeCompare(b, 'en', { sensitivity: 'base' }),
    ),
  );
});

test('pollen API rejects unsupported cities with discovery guidance', async () => {
  const response = await GET(
    new NextRequest('http://localhost/api/pollen?city=atlantis'),
  );
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.code, 'UNSUPPORTED_CITY');
  assert.equal(body.city, 'atlantis');
  assert.equal(body.supportedCities, '/api/cities');
  assert.equal(body.mcpTool, 'list_cities');
  assert.match(body.error, /Unsupported city 'atlantis'/);
});

test('daily pollen rows use the canonical measurement names', () => {
  const [row] = toDailyPollenRows([
    {
      date: '2026-08-26',
      tree: 20,
      grass: 5,
      weed: 2,
      total: 27,
      timezone: 'America/Denver',
      species: { Weed: { Ragweed: 2 } },
    },
  ]);

  assert.deepEqual(Object.keys(row), [
    'date',
    'tree',
    'grass',
    'weed',
    'total',
    'timezone',
    'species',
    'risk_tree',
    'risk_grass',
    'risk_weed',
  ]);
  assert.equal('avg_tree' in row, false);
  assert.equal(row.tree, 20);
  assert.equal(row.total, 27);
});
