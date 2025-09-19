'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type Props = {
  city: string;
  dates: string[];
  selected?: string;
};

export default function CityDateSelector({ city, dates, selected }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState<string>(selected || '');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setValue(selected || '');
  }, [selected]);

  const handleChange = (nextValue: string) => {
    setValue(nextValue);
    startTransition(() => {
      const search = nextValue ? `?date=${encodeURIComponent(nextValue)}` : '';
      const targetPath = pathname || `/city/${encodeURIComponent(city)}`;
      router.replace(`${targetPath}${search}`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-600" htmlFor="city-date-select">
        Date
      </label>
      <div className="relative">
        <select
          id="city-date-select"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          disabled={!dates.length || isPending}
        >
          {!value && <option value="">Select a date</option>}
          {dates.map((date) => (
            <option key={date} value={date}>
              {date}
            </option>
          ))}
        </select>
        {isPending && (
          <span className="absolute inset-y-0 right-3 flex items-center text-xs font-medium uppercase tracking-wide text-slate-400">
            Loading…
          </span>
        )}
      </div>
    </div>
  );
}
