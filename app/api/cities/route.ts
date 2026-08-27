import { NextRequest } from 'next/server';
import { publicDataResponse } from '@/lib/api-response';
import { getSupportedCities } from '@/lib/cities';

export async function GET(_req: NextRequest) {
  try {
    const cities = (await getSupportedCities())
      .map(({ name, slug }) => ({ name, slug }))
      .sort((a: { name: string }, b: { name: string }) =>
        a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }),
      );
    return publicDataResponse({ cities });
  } catch (error) {
    console.error('[cities] error', error);
    return Response.json({ error: 'Failed to load cities' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
