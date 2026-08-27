export const PUBLIC_DATA_CACHE_CONTROL =
  'public, max-age=0, s-maxage=300, stale-while-revalidate=3600';

export function publicDataResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('cache-control')) {
    headers.set('cache-control', PUBLIC_DATA_CACHE_CONTROL);
  }
  return Response.json(body, { ...init, headers });
}
