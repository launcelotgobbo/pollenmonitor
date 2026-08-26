const DEFAULT_SITE_URL = 'https://pollenmonitor.dev';

export const SITE_URL = (process.env.NEXT_PUBLIC_BASE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');

export function absoluteUrl(path = '/') {
  return new URL(path, `${SITE_URL}/`).toString();
}

export function cityDisplayName(slug: string) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function normalizeCitySlug(value: string) {
  return (value || '').trim().toLowerCase();
}
