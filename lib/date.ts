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

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const RFC3339_TIMESTAMP_PATTERN =
  /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

export function parseUtcCalendarDate(value: string): Date | null {
  const match = CALENDAR_DATE_PATTERN.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  if (Number(year) < 1) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() + 1 !== Number(month) ||
    parsed.getUTCDate() !== Number(day)
  ) {
    return null;
  }
  return parsed;
}

export function parseUtcDateOrTimestamp(value: string): Date | null {
  const calendarDate = parseUtcCalendarDate(value);
  if (calendarDate) return calendarDate;

  const match = RFC3339_TIMESTAMP_PATTERN.exec(value);
  if (!match || !parseUtcCalendarDate(match[1])) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function utcDayWindow(date: string): { dayStart: string; dayEnd: string } {
  const dayStart = new Date(`${date}T00:00:00Z`);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  return { dayStart: dayStart.toISOString(), dayEnd: dayEnd.toISOString() };
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
