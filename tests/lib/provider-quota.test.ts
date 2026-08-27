import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  ambeeDailyQuota,
  ambeeForecastReserve,
  openweatherDailyQuota,
} from '@/lib/provider-quota';

test('provider quota settings accept only whole-number call counts', () => {
  const original = {
    ambee: process.env.AMBEE_DAILY_QUOTA,
    forecast: process.env.AMBEE_FORECAST_RESERVE,
    openweather: process.env.OPENWEATHER_DAILY_QUOTA,
  };

  try {
    process.env.AMBEE_DAILY_QUOTA = '199.5';
    process.env.AMBEE_FORECAST_RESERVE = '4.5';
    process.env.OPENWEATHER_DAILY_QUOTA = '900.5';

    assert.equal(ambeeDailyQuota(), 200);
    assert.equal(ambeeForecastReserve(176), 176);
    assert.equal(openweatherDailyQuota(), 1000);

    process.env.AMBEE_DAILY_QUOTA = '180';
    process.env.AMBEE_FORECAST_RESERVE = '12';
    process.env.OPENWEATHER_DAILY_QUOTA = '900';

    assert.equal(ambeeDailyQuota(), 180);
    assert.equal(ambeeForecastReserve(176), 12);
    assert.equal(openweatherDailyQuota(), 900);
  } finally {
    restoreEnv('AMBEE_DAILY_QUOTA', original.ambee);
    restoreEnv('AMBEE_FORECAST_RESERVE', original.forecast);
    restoreEnv('OPENWEATHER_DAILY_QUOTA', original.openweather);
  }
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
