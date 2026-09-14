import { normalizeRiskValue } from '@/lib/risk';

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatLongDate(date: string | null) {
  if (!date) return null;
  try {
    return LONG_DATE_FORMATTER.format(new Date(`${date}T00:00:00Z`));
  } catch {
    return date;
  }
}

export function formatNumeric(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-US') : '—';
}

export function riskBadgeClass(value?: string | null) {
  const normalized = normalizeRiskValue(value);
  if (['very-high', 'severe', 'extreme'].includes(normalized ?? ''))
    return 'bg-rose-100 text-rose-700';
  if (normalized === 'high') return 'bg-orange-100 text-orange-700';
  if (['moderate', 'medium'].includes(normalized ?? '')) return 'bg-amber-100 text-amber-700';
  if (['low', 'very-low', 'minimal'].includes(normalized ?? ''))
    return 'bg-emerald-100 text-emerald-700';
  return 'bg-slate-100 text-slate-600';
}
