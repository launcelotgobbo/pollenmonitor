import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  publicDataResponse,
  PUBLIC_DATA_CACHE_CONTROL,
} from '@/lib/api-response';

test('publicDataResponse applies the shared five-minute edge cache policy', async () => {
  const response = publicDataResponse(
    { ok: true },
    { headers: { 'x-test-header': 'preserved' } },
  );

  assert.equal(response.headers.get('cache-control'), PUBLIC_DATA_CACHE_CONTROL);
  assert.equal(response.headers.get('x-test-header'), 'preserved');
  assert.deepEqual(await response.json(), { ok: true });
});

test('publicDataResponse preserves an explicit cache policy and media type', () => {
  const response = publicDataResponse(
    { type: 'FeatureCollection' },
    {
      headers: {
        'cache-control': 'public, s-maxage=86400',
        'content-type': 'application/geo+json',
      },
    },
  );

  assert.equal(response.headers.get('cache-control'), 'public, s-maxage=86400');
  assert.equal(response.headers.get('content-type'), 'application/geo+json');
});
