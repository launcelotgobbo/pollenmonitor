import { strict as assert } from 'node:assert';
import test from 'node:test';
import { API_VERSION } from '@/lib/api-version';
import { MAP_AGGREGATION } from '@/lib/mapData';
import { OPENAPI_DOCUMENT } from '@/lib/openapi';

function walk(value: unknown, visit: (value: unknown) => void) {
  visit(value);
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) walk(item, visit);
  }
}

function resolveLocalRef(root: unknown, ref: string): unknown {
  return ref
    .slice(2)
    .split('/')
    .reduce<unknown>((value, segment) => {
      if (!value || typeof value !== 'object') return undefined;
      return (value as Record<string, unknown>)[segment.replace(/~1/g, '/').replace(/~0/g, '~')];
    }, root);
}

test('OpenAPI document exposes every public data endpoint', () => {
  assert.equal(OPENAPI_DOCUMENT.openapi, '3.1.0');
  assert.deepEqual(
    Object.keys(OPENAPI_DOCUMENT.paths).sort(),
    [
      '/api/available-dates',
      '/api/cities',
      '/api/forecast',
      '/api/latest-date',
      '/api/map-data',
      '/api/pollen',
      '/api/pollen-range',
      '/api/weather',
    ],
  );
});

test('OpenAPI document has unique operation IDs and valid local references', () => {
  const operationIds = Object.values(OPENAPI_DOCUMENT.paths).map((path) => path.get.operationId);
  assert.equal(new Set(operationIds).size, operationIds.length);

  walk(OPENAPI_DOCUMENT, (value) => {
    if (!value || typeof value !== 'object' || !('$ref' in value)) return;
    const ref = (value as { $ref: string }).$ref;
    assert.ok(ref.startsWith('#/'), `Only local OpenAPI references are expected: ${ref}`);
    assert.notEqual(resolveLocalRef(OPENAPI_DOCUMENT, ref), undefined, `Unresolved OpenAPI reference: ${ref}`);
  });
});

test('OpenAPI document does not publish rate-limit claims', () => {
  const serialized = JSON.stringify(OPENAPI_DOCUMENT).toLowerCase();
  assert.equal(serialized.includes('rate limit'), false);
  assert.equal(serialized.includes('rate-limit'), false);
});

test('OpenAPI documents runtime error and map media-type contracts', () => {
  assert.ok(OPENAPI_DOCUMENT.paths['/api/pollen-range'].get.responses['500']);
  const mapContent = OPENAPI_DOCUMENT.paths['/api/map-data'].get.responses['200'].content;
  assert.deepEqual(Object.keys(mapContent), ['application/geo+json']);
  assert.equal(
    OPENAPI_DOCUMENT.components.schemas.MapFeatureCollection.properties.aggregation.const,
    MAP_AGGREGATION,
  );
});

test('OpenAPI documents strict aggregation and one pollen-range row shape', () => {
  const operation = OPENAPI_DOCUMENT.paths['/api/pollen-range'].get;
  const aggregate = operation.parameters.find((parameter: any) => parameter.name === 'aggregate') as
    | { schema: { enum: readonly string[] } }
    | undefined;
  assert.ok(aggregate);
  assert.deepEqual(aggregate.schema.enum, ['none', 'day']);
  assert.equal(
    OPENAPI_DOCUMENT.components.schemas.PollenRangeResponse.properties.rows.items.$ref,
    '#/components/schemas/PollenRangeRow',
  );
  for (const name of ['from', 'to']) {
    const parameter = operation.parameters.find((candidate: any) => candidate.name === name) as
      | { schema: { oneOf: readonly unknown[] } }
      | undefined;
    assert.ok(parameter);
    assert.deepEqual(parameter.schema.oneOf, [
      { $ref: '#/components/schemas/Date' },
      { $ref: '#/components/schemas/DateTime' },
    ]);
  }
});

test('OpenAPI advertises MCP and the normalized daily pollen contract', () => {
  assert.equal(API_VERSION, '2.1.0');
  assert.equal(OPENAPI_DOCUMENT.info.version, API_VERSION);
  assert.equal(OPENAPI_DOCUMENT['x-mcp-server'].url, 'https://pollenmonitor.dev/mcp');
  assert.equal(OPENAPI_DOCUMENT['x-mcp-server'].transport, 'streamable-http');
  assert.ok(OPENAPI_DOCUMENT.paths['/api/pollen'].get.responses['404']);
  assert.deepEqual(
    OPENAPI_DOCUMENT.components.schemas.DailyPollen.required,
    ['date', 'tree', 'grass', 'weed', 'total', 'species'],
  );
});

test('OpenAPI documents the shared unsupported-city contract', () => {
  for (const path of ['/api/pollen', '/api/pollen-range', '/api/forecast', '/api/weather'] as const) {
    assert.equal(
      OPENAPI_DOCUMENT.paths[path].get.responses['404'].$ref,
      '#/components/responses/UnsupportedCity',
    );
  }

  assert.equal(
    OPENAPI_DOCUMENT.components.responses.UnsupportedCity.content['application/json'].schema.$ref,
    '#/components/schemas/UnsupportedCityError',
  );
  const schema = OPENAPI_DOCUMENT.components.schemas.UnsupportedCityError;
  assert.deepEqual(schema.required, [
    'error',
    'code',
    'city',
    'supportedCities',
    'mcpTool',
  ]);
  assert.deepEqual(schema.properties.code.enum, ['UNSUPPORTED_CITY']);
  assert.equal(schema.properties.supportedCities.const, '/api/cities');
  assert.equal(schema.properties.mcpTool.const, 'list_cities');
});
