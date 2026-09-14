'use client';

import { useEffect, useRef, useState } from 'react';
import type { WeatherDaily } from './types';

export function useDailyWeather({ city, date }: { city: string; date: string | null }) {
  const [weatherRows, setWeatherRows] = useState<WeatherDaily[]>([]);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!date) {
      setWeatherRows([]);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoadingWeather(true);
    setWeatherError(null);
    setWeatherRows([]);

    fetch(`/api/weather?city=${encodeURIComponent(city)}&date=${encodeURIComponent(date)}`, {
      signal: controller.signal,
    })
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
  }, [city, date]);

  return { weatherRows, isLoadingWeather, weatherError };
}
