'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = {
  initialCity?: string;
};

export default function CityInput({ initialCity = 'new-york' }: Props) {
  const [city, setCity] = useState(initialCity);
  const router = useRouter();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const next = `/city/${encodeURIComponent(city.trim())}`;
        router.push(next);
      }}
      style={{ display: 'flex', gap: 8 }}
    >
      <input
        type="text"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        placeholder="city-slug (e.g., new-york)"
      />
      <button type="submit">View</button>
    </form>
  );
}
