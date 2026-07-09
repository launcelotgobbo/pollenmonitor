import { strict as assert } from 'node:assert';
import test from 'node:test';
import { fetchWithRetry } from '@/lib/http';

async function withStubbedFetch<T>(
  responses: Array<Response | Error>,
  fn: () => Promise<T>,
): Promise<{ result: T; calls: number }> {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    const next = responses[Math.min(calls, responses.length - 1)];
    calls++;
    if (next instanceof Error) throw next;
    return next;
  }) as typeof fetch;
  try {
    const result = await fn();
    return { result, calls };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const fastRetry = { retries: 2, baseDelayMs: 1, maxDelayMs: 2 };

test('fetchWithRetry returns immediately on success', async () => {
  const { result, calls } = await withStubbedFetch(
    [new Response('ok', { status: 200 })],
    () => fetchWithRetry('https://example.com', undefined, fastRetry),
  );
  assert.equal(result.status, 200);
  assert.equal(calls, 1);
});

test('fetchWithRetry retries 5xx responses and succeeds', async () => {
  const { result, calls } = await withStubbedFetch(
    [
      new Response('boom', { status: 503 }),
      new Response('boom', { status: 500 }),
      new Response('ok', { status: 200 }),
    ],
    () => fetchWithRetry('https://example.com', undefined, fastRetry),
  );
  assert.equal(result.status, 200);
  assert.equal(calls, 3);
});

test('fetchWithRetry returns the last 5xx response once retries are exhausted', async () => {
  const { result, calls } = await withStubbedFetch(
    [new Response('boom', { status: 502 })],
    () => fetchWithRetry('https://example.com', undefined, fastRetry),
  );
  assert.equal(result.status, 502);
  assert.equal(calls, 3);
});

test('fetchWithRetry does not retry 429 quota responses', async () => {
  const { result, calls } = await withStubbedFetch(
    [new Response('limit', { status: 429 })],
    () => fetchWithRetry('https://example.com', undefined, fastRetry),
  );
  assert.equal(result.status, 429);
  assert.equal(calls, 1);
});

test('fetchWithRetry retries network errors and rethrows the final one', async () => {
  await assert.rejects(
    withStubbedFetch(
      [new Error('ECONNRESET')],
      () => fetchWithRetry('https://example.com', undefined, fastRetry),
    ),
    /ECONNRESET/,
  );
});

test('fetchWithRetry recovers from a transient network error', async () => {
  const { result, calls } = await withStubbedFetch(
    [new Error('ETIMEDOUT'), new Response('ok', { status: 200 })],
    () => fetchWithRetry('https://example.com', undefined, fastRetry),
  );
  assert.equal(result.status, 200);
  assert.equal(calls, 2);
});
