import type { MetadataRoute } from 'next';
import { loadTopCities } from '@/lib/ingest/cities';
import { absoluteUrl } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cities = await loadTopCities();
  const uniqueCities = Array.from(new Map(cities.map((city) => [city.slug, city])).values());
  const lastModified = new Date();

  return [
    {
      url: absoluteUrl('/map'),
      lastModified,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: absoluteUrl('/docs/api'),
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: absoluteUrl('/docs/mcp'),
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    ...uniqueCities.map((city) => ({
      url: absoluteUrl(`/city/${city.slug}`),
      lastModified,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ];
}
