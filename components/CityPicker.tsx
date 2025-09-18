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
    <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      City:
      <select
        value={value}
        onChange={(e) => {
          const slug = e.target.value;
          setValue(slug);
          if (slug) router.push(`/city/${encodeURIComponent(slug)}`);
        }}
      >
        {!value && <option value="">Select a city</option>}
        {cities.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}

