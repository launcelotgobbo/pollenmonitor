import type { NextRequest } from 'next/server';

export function GET(req: NextRequest) {
  return Response.redirect(new URL('/openapi.json', req.url), 308);
}
