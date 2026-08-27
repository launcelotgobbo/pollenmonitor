const DEFAULT_AMBEE_DAILY_QUOTA = 200;
const DEFAULT_OPENWEATHER_DAILY_QUOTA = 1000;
const AMBEE_FORECAST_RESERVE_FLOOR = 5;

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function ambeeDailyQuota() {
  return positiveInteger(
    process.env.AMBEE_DAILY_QUOTA,
    DEFAULT_AMBEE_DAILY_QUOTA,
  );
}

export function openweatherDailyQuota() {
  return positiveInteger(
    process.env.OPENWEATHER_DAILY_QUOTA,
    DEFAULT_OPENWEATHER_DAILY_QUOTA,
  );
}

export function ambeeForecastReserve(cityCount: number) {
  const override = Number(process.env.AMBEE_FORECAST_RESERVE);
  if (Number.isInteger(override) && override >= 0) return override;
  return Math.max(AMBEE_FORECAST_RESERVE_FLOOR, cityCount);
}
