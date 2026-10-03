import { finishIngest, reserveOpenWeatherCall, startIngest } from '@/lib/db';
import { ingestBudget, INGEST_BUDGET_MS } from '@/lib/ingest/budget';
import { ingestConcurrency } from '@/lib/ingest/concurrency';
import { ingestWeatherForCities } from '@/lib/ingest/weather-daily';
import {
  claimWeatherTask,
  finishWeatherTask,
  pendingWeatherTasks,
} from '@/lib/ingest/weather-queue';
import { openweatherDailyQuota } from '@/lib/provider-quota';

export async function runWeatherWorker(jobId: string, budgetMs = INGEST_BUDGET_MS) {
  const started = Date.now();
  const budget = ingestBudget(budgetMs);
  let logId: string | undefined;
  let completed = 0;
  let failed = 0;
  let quotaExhausted = false;
  let openweatherCalls = 0;
  try {
    logId = await startIngest('weather-ingest', { jobId });
    const workers = Array.from({ length: Math.min(ingestConcurrency(), 5) }, async () => {
      while (!budget.signal.aborted && !quotaExhausted) {
        const task = await claimWeatherTask();
        if (!task) break;
        const { summary } = await ingestWeatherForCities({
          cities: [task.city],
          fromISO: task.fromISO,
          toISO: task.toISO,
          signal: budget.signal,
          onProviderCall: async () => {
            if (
              quotaExhausted ||
              !(await reserveOpenWeatherCall(
                'weather-ingest-openweather',
                jobId,
                openweatherDailyQuota(),
              ))
            ) {
              quotaExhausted = true;
              throw new Error('OpenWeather daily quota exhausted');
            }
            openweatherCalls++;
          },
        });
        await finishWeatherTask(
          task,
          summary.ok,
          budget.signal.aborted ? 'timeout' : quotaExhausted ? 'quota' : 'provider',
        );
        if (summary.ok) completed++;
        else failed++;
      }
    });
    // Do not return while other workers are still writing checkpoints.
    const outcomes = await Promise.allSettled(workers);
    if (outcomes.some((outcome) => outcome.status === 'rejected')) {
      throw new Error('Weather checkpoint failed');
    }
    const pending = await pendingWeatherTasks();
    const status = pending === 0 ? 'success' : 'partial';
    const result = {
      ok: pending === 0,
      status,
      completed,
      failed,
      pending,
      timedOut: budget.signal.aborted,
      quotaExhausted,
      openweatherCalls,
      ms: Date.now() - started,
    };
    await finishIngest(logId, status, result);
    return result;
  } catch (error) {
    if (logId) {
      await finishIngest(logId, 'failure', {
        ok: false,
        completed,
        failed,
        openweatherCalls,
        ms: Date.now() - started,
        error: 'Weather worker failed before completion',
      });
    }
    throw error;
  } finally {
    budget.dispose();
  }
}
