import { strict as assert } from 'node:assert';
import test from 'node:test';
import { isBearerAuthorized, isIngestAuthorized } from '@/lib/ingest-auth';

function request(headers: Record<string, string>, url = 'http://localhost/api/ingest-logs') {
  return new Request(url, { headers });
}

function withToken<T>(token: string | undefined, fn: () => T): T {
  const previous = process.env.INGEST_TOKEN;
  if (token === undefined) delete process.env.INGEST_TOKEN;
  else process.env.INGEST_TOKEN = token;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.INGEST_TOKEN;
    else process.env.INGEST_TOKEN = previous;
  }
}

test('accepts a matching x-ingest-token header', () => {
  withToken('correct-horse-battery', () => {
    assert.equal(isIngestAuthorized(request({ 'x-ingest-token': 'correct-horse-battery' })), true);
  });
});

test('accepts a matching bearer token', () => {
  withToken('correct-horse-battery', () => {
    assert.equal(
      isIngestAuthorized(request({ authorization: 'Bearer correct-horse-battery' })),
      true,
    );
  });
});

test('validates arbitrary bearer secrets without direct string comparison', () => {
  const req = request({ authorization: 'Bearer cron-secret' });
  assert.equal(isBearerAuthorized(req, 'cron-secret'), true);
  assert.equal(isBearerAuthorized(req, 'wrong-secret'), false);
  assert.equal(isBearerAuthorized(req, ''), false);
});

test('rejects wrong, absent, and prefix-matching tokens', () => {
  withToken('correct-horse-battery', () => {
    assert.equal(isIngestAuthorized(request({ 'x-ingest-token': 'wrong' })), false);
    assert.equal(isIngestAuthorized(request({ 'x-ingest-token': 'correct-horse' })), false);
    assert.equal(isIngestAuthorized(request({})), false);
  });
});

test('rejects tokens supplied in the query string', () => {
  withToken('correct-horse-battery', () => {
    assert.equal(
      isIngestAuthorized(request({}, 'http://localhost/api/ingest-logs?token=correct-horse-battery')),
      false,
    );
  });
});

test('denies every request when INGEST_TOKEN is unset', () => {
  withToken(undefined, () => {
    assert.equal(isIngestAuthorized(request({ 'x-ingest-token': 'anything' })), false);
    assert.equal(isIngestAuthorized(request({})), false);
  });
});
