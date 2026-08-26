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

export function formatUtcSqlTimestamp(date: Date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export function isHourInTimeZone(date: Date, timeZone: string, hour: number) {
  const hourPart = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(date)
    .find((part) => part.type === 'hour');

  return hourPart?.value === String(hour).padStart(2, '0');
}
