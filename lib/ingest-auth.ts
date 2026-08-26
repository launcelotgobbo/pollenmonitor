import { timingSafeEqual } from 'node:crypto';

function secureEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Shared auth for operator-only endpoints. Tokens are read from headers only:
 * query strings end up in request logs, browser history, and proxy logs.
 */
export function isIngestAuthorized(req: Request): boolean {
  const expected = process.env.INGEST_TOKEN || '';
  if (!expected) return false;

  const header = req.headers.get('x-ingest-token');
  if (header && secureEquals(header, expected)) return true;

  const authorization = req.headers.get('authorization') || '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  return Boolean(bearer) && secureEquals(bearer, expected);
}

export function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
