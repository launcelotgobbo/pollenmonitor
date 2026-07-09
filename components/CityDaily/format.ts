import type { HourlyRow } from './types';

const timeFormatterCache = new Map<string, Intl.DateTimeFormat>();

export function getTimeFormatter(timezone: string) {
  if (!timeFormatterCache.has(timezone)) {
    timeFormatterCache.set(
      timezone,
      new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        hourCycle: 'h23',
        timeZone: timezone,
      }),
    );
  }
  return timeFormatterCache.get(timezone)!;
}

export function formatLongDate(date: string | null) {
  if (!date) return null;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
    return formatter.format(new Date(`${date}T00:00:00Z`));
  } catch {
    return date;
  }
}

export function formatNumeric(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-US') : '—';
}

export function riskBadgeClass(value?: string | null) {
  if (!value) return 'bg-slate-100 text-slate-600';
  const normalized = value.toString().toLowerCase();
  if (['very high', 'severe', 'extreme'].includes(normalized)) return 'bg-rose-100 text-rose-700';
  if (['high'].includes(normalized)) return 'bg-orange-100 text-orange-700';
  if (['moderate', 'medium'].includes(normalized)) return 'bg-amber-100 text-amber-700';
  if (['low', 'very low', 'minimal'].includes(normalized)) return 'bg-emerald-100 text-emerald-700';
  return 'bg-slate-100 text-slate-600';
}

export function getTimezoneFromRows(rows: HourlyRow[], fallback: string | null) {
  const fromRow = rows.find((row) => row.timezone)?.timezone;
  const tz = typeof fromRow === 'string' && fromRow.trim().length ? fromRow.trim() : fallback;
  return tz || 'UTC';
}
