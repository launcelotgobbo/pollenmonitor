import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';

const CACHE_CONTROL = 's-maxage=3600, stale-while-revalidate=600';

async function loadLocalStyle() {
  const fs = await import('node:fs/promises');
  const filePath = path.join(process.cwd(), 'public', 'map-style.json');
  return fs.readFile(filePath, 'utf-8');
}

export async function GET(_req: NextRequest) {
  const mapTilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;

  try {
    if (mapTilerKey) {
      const upstream = await fetch(`https://api.maptiler.com/maps/streets/style.json?key=${mapTilerKey}`, {
        headers: {
          accept: 'application/json',
        },
        cache: 'no-store',
      });

      if (!upstream.ok) {
        throw new Error(`MapTiler responded with ${upstream.status}`);
      }

      const text = await upstream.text();
      return new NextResponse(text, {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': CACHE_CONTROL,
        },
      });
    }

    const fallback = await loadLocalStyle();
    return new NextResponse(fallback, {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('[map-style] failed to load style', error);
    return new NextResponse(
      JSON.stringify({ error: 'Unable to load map style' }),
      {
        status: 502,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      },
    );
  }
}

export const dynamic = 'force-dynamic';
