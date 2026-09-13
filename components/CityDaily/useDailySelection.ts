'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { WeatherDaily } from './types';

type Options = {
  city: string;
  initialSelected: string | null;
};

export function useDailySelection({ city, initialSelected }: Options) {
  const [selectedDate, setSelectedDate] = useState(initialSelected);
  const [weatherRows, setWeatherRows] = useState<WeatherDaily[]>([]);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!selectedDate) {
      setWeatherRows([]);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoadingWeather(true);
    setWeatherError(null);
    setWeatherRows([]);

    fetch(
      `/api/weather?city=${encodeURIComponent(city)}&date=${encodeURIComponent(selectedDate)}`,
      {
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const json = await response.json();
        const rows = Array.isArray(json?.rows) ? json.rows : [];
        setWeatherRows(
          rows.map((row: any) => ({
            date: row.date,
            aqi: typeof row.aqi === 'number' ? row.aqi : null,
            temp_day_c: typeof row.temp_day_c === 'number' ? row.temp_day_c : null,
            temp_min_c: typeof row.temp_min_c === 'number' ? row.temp_min_c : null,
            temp_max_c: typeof row.temp_max_c === 'number' ? row.temp_max_c : null,
          })),
        );
      })
      .catch((error: Error) => {
        if (error.name === 'AbortError') return;
        setWeatherRows([]);
        setWeatherError('Daily weather is unavailable.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingWeather(false);
      });

    return () => controller.abort();
  }, [city, selectedDate]);

  const handleSelect = (date: string) => {
    setSelectedDate(date);
    startTransition(() => {
      const url = new URL(window.location.href);
      if (date) url.searchParams.set('date', date);
      else url.searchParams.delete('date');
      window.history.replaceState(null, '', `${url.pathname}${url.search}`);
    });
  };

  return {
    selectedDate,
    weatherRows,
    isLoadingWeather,
    weatherError,
    handleSelect,
  };
}
