import type { MetadataRoute } from 'next';
import { getSupportedCities } from '@/lib/cities';
import { absoluteUrl } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cities = await getSupportedCities();
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
    {
      url: absoluteUrl('/docs/changelog'),
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    ...uniqueCities.map((city) => ({
      url: absoluteUrl(`/city/${city.slug}`),
      lastModified,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ];
}
