'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export type CityOption = { name: string; slug: string };

export default function CityPicker({
  cities,
  current,
  id = 'city-picker',
}: {
  cities: CityOption[];
  current?: string;
  id?: string;
}) {
  const [value, setValue] = useState<string>(current || '');
  const router = useRouter();

  useEffect(() => {
    setValue(current || '');
  }, [current]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-600" htmlFor={id}>
        City
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          const slug = event.target.value;
          setValue(slug);
          if (slug) {
            router.push(`/city/${encodeURIComponent(slug)}`);
          }
        }}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
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
