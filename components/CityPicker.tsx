'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type City = { name: string; slug: string };

export default function CityPicker({ current }: { current?: string }) {
  const [cities, setCities] = useState<City[]>([]);
  const [value, setValue] = useState<string>(current || '');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/cities')
      .then((r) => r.json())
      .then((d) => setCities(d.cities || []))
      .catch(() => setCities([]));
  }, []);

  useEffect(() => {
    setValue(current || '');
  }, [current]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-600" htmlFor="city-picker">
        City
      </label>
      <select
        id="city-picker"
        value={value}
        onChange={(event) => {
          const slug = event.target.value;
          setValue(slug);
          if (slug) {
            router.push(`/city/${encodeURIComponent(slug)}`);
          }
        }}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!cities.length}
      >
        {!value && <option value="">Select a city</option>}
        {cities.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
