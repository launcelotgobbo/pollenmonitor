import { OPENAPI_DOCUMENT } from '@/lib/openapi';

export function GET() {
  return Response.json(OPENAPI_DOCUMENT, {
    headers: {
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
