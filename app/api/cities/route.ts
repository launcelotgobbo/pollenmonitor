import { NextRequest } from 'next/server';
import { loadTopCities } from '@/lib/ingest/cities';

export async function GET(_req: NextRequest) {
  try {
    const cities = (await loadTopCities())
      .map(({ name, slug }) => ({ name, slug }))
      .sort((a: { name: string }, b: { name: string }) =>
        a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }),
      );
    if (cities.length === 0) throw new Error('No supported city definitions available');
    return Response.json({ cities });
  } catch (error) {
    console.error('[cities] error', error);
    return Response.json({ error: 'Failed to load cities' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
