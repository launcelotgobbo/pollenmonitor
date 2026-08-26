/**
 * Parse provider/job timestamps as UTC when no timezone is present.
 * Job windows use `YYYY-MM-DD HH:MM:SS`, whose digits represent UTC even
 * though the JavaScript Date constructor would otherwise interpret them in
 * the server's local timezone.
 */
export function parseUtcDate(value: string): Date | null {
  const normalized = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(value)
    ? value
    : `${value.replace(' ', 'T')}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
