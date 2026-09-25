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

test('fetchWithRetry reports every attempt, including retries', async () => {
  let attempts = 0;
  const { calls } = await withStubbedFetch(
    [new Response('boom', { status: 500 }), new Response('ok', { status: 200 })],
    () => fetchWithRetry('https://example.com', undefined, { ...fastRetry, onAttempt: () => attempts++ }),
  );
  assert.equal(calls, 2);
  assert.equal(attempts, 2);
});

function hangingFetch(): { fetch: typeof fetch; signals: AbortSignal[] } {
  const signals: AbortSignal[] = [];
  const stub = ((_input: any, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (!signal) return;
      signals.push(signal);
      // AbortSignal.timeout uses an unref'd timer; a real socket would keep the
      // process alive, so stand in for it here.
      const keepAlive = setTimeout(() => {}, 10_000);
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(keepAlive);
          reject(signal.reason);
        },
        { once: true },
      );
    })) as typeof fetch;
  return { fetch: stub, signals };
}

test('fetchWithRetry aborts a hung request after timeoutMs and retries it', async () => {
  const originalFetch = globalThis.fetch;
  const { fetch: stub, signals } = hangingFetch();
  globalThis.fetch = stub;
  try {
    await assert.rejects(
      fetchWithRetry('https://example.com', undefined, { ...fastRetry, retries: 1, timeoutMs: 20 }),
      (error: any) => error?.name === 'TimeoutError',
    );
    assert.equal(signals.length, 2, 'the timed-out attempt is retried once');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchWithRetry does not retry when the caller aborts', async () => {
  const originalFetch = globalThis.fetch;
  const { fetch: stub, signals } = hangingFetch();
  globalThis.fetch = stub;
  const controller = new AbortController();
  try {
    const pending = fetchWithRetry(
      'https://example.com',
      { signal: controller.signal },
      { ...fastRetry, timeoutMs: 1000 },
    );
    controller.abort(new Error('caller gave up'));
    await assert.rejects(pending, /caller gave up/);
    assert.equal(signals.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
