export function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return { url, key: serviceKey };
}

export async function supabaseGet<T = any>(path: string, search: string): Promise<T> {
  const { url, key } = getSupabaseEnv();
  const qs = search.startsWith('?') ? search : `?${search}`;
  const full = `${url.replace(/\/$/, '')}/rest/v1/${path}${qs}`;
  const res = await fetch(full, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Supabase REST ${res.status}: ${txt}`);
  }
  return (await res.json()) as T;
}
