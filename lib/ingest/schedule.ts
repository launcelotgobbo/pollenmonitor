import { isHourInTimeZone } from '@/lib/date';

export const DAILY_INGEST_TIME_ZONE = 'America/Los_Angeles';
export const DAILY_INGEST_LOCAL_HOUR = 1;

export function shouldRunDailyIngest(now: Date, cronAuthorized: boolean) {
  if (!cronAuthorized) return true;
  if (!isHourInTimeZone(now, DAILY_INGEST_TIME_ZONE, DAILY_INGEST_LOCAL_HOUR)) {
    return false;
  }

  // The 1 AM hour occurs twice when daylight saving time ends. Run only
  // during its first occurrence so the daily job still executes once.
  const oneHourEarlier = new Date(now.getTime() - 60 * 60 * 1000);
  return !isHourInTimeZone(
    oneHourEarlier,
    DAILY_INGEST_TIME_ZONE,
    DAILY_INGEST_LOCAL_HOUR,
  );
}
