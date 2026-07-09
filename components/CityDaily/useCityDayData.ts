'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { getTimezoneFromRows } from './format';
import type { HourlyRow, WeatherDaily } from './types';

type Options = {
  city: string;
  initialSelected: string | null;
  initialHourly: HourlyRow[];
  initialTimezone: string | null;
};

export function useCityDayData({ city, initialSelected, initialHourly, initialTimezone }: Options) {
  const [selectedDate, setSelectedDate] = useState(initialSelected);
  const [hourlyRows, setHourlyRows] = useState<HourlyRow[]>(initialHourly);
  const [timezone, setTimezone] = useState(() => getTimezoneFromRows(initialHourly, initialTimezone));
  const [isLoading, setIsLoading] = useState(false);
  const [weatherRows, setWeatherRows] = useState<WeatherDaily[]>([]);
  const [error, setError] = useState<string | null>(null);
  const initialDateRef = useRef(initialSelected);
  const initialRowsRef = useRef(initialHourly);
  const abortRef = useRef<AbortController | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    async function load(date: string | null) {
      if (!date) {
        setHourlyRows([]);
        setTimezone('UTC');
        return;
      }

      if (date === initialDateRef.current) {
        setHourlyRows(initialRowsRef.current);
        setTimezone(getTimezoneFromRows(initialRowsRef.current, initialTimezone));
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/pollen?city=${encodeURIComponent(city)}&date=${encodeURIComponent(date)}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const json = await response.json();
        const rows = Array.isArray(json?.rows) ? (json.rows as HourlyRow[]) : [];
        setHourlyRows(rows);
        setTimezone(getTimezoneFromRows(rows, initialTimezone));

        // Fetch weather daily row for same date
        try {
          const wres = await fetch(`/api/weather?city=${encodeURIComponent(city)}&date=${encodeURIComponent(date)}`, {
            signal: controller.signal,
            cache: 'no-store',
          });
          if (wres.ok) {
            const wjson = await wres.json();
            const list = Array.isArray(wjson?.rows) ? (wjson.rows as any[]) : [];
            const mapped: WeatherDaily[] = list.map((r) => ({
              date: r.date,
              aqi: typeof r.aqi === 'number' ? r.aqi : null,
              temp_day_c: typeof r.temp_day_c === 'number' ? r.temp_day_c : null,
              temp_min_c: typeof r.temp_min_c === 'number' ? r.temp_min_c : null,
              temp_max_c: typeof r.temp_max_c === 'number' ? r.temp_max_c : null,
            }));
            setWeatherRows(mapped);
          } else {
            setWeatherRows([]);
          }
        } catch {
          setWeatherRows([]);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.error('[city-daily-explorer] failed to load hourly data', err);
        setError('Unable to load hourly data for this day.');
      } finally {
        setIsLoading(false);
      }
    }

    load(selectedDate ?? null);
  }, [city, initialTimezone, selectedDate]);

  const handleSelect = (date: string) => {
    setSelectedDate(date);
    startTransition(() => {
      try {
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          if (date) {
            url.searchParams.set('date', date);
          } else {
            url.searchParams.delete('date');
          }
          window.history.replaceState(null, '', `${url.pathname}${url.search ? `?${url.search}` : ''}`);
        }
      } catch (err) {
        console.error('[city-daily-explorer] failed to update URL', err);
      }
    });
  };

  return { selectedDate, hourlyRows, timezone, weatherRows, isLoading, error, handleSelect };
}
