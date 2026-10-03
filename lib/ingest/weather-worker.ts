import { finishIngest, startIngest } from '@/lib/db';
import { ingestBudget, INGEST_BUDGET_MS } from '@/lib/ingest/budget';
import { ingestConcurrency } from '@/lib/ingest/concurrency';
import { createWeatherIngest, createWeatherQuota } from '@/lib/ingest/weather-daily';
import {
  claimWeatherTask,
  finishWeatherTask,
  pendingWeatherTasks,
} from '@/lib/ingest/weather-queue';

export async function runWeatherWorker(jobId: string, budgetMs = INGEST_BUDGET_MS) {
  const started = Date.now();
  const budget = ingestBudget(budgetMs);
  let logId: string | undefined;
  let completed = 0;
  let failed = 0;
  const quota = createWeatherQuota('weather-ingest', jobId);
  const weather = createWeatherIngest({ signal: budget.signal, onProviderCall: quota.reserve });
  try {
    logId = await startIngest('weather-ingest', { jobId });
    const workers = Array.from({ length: Math.min(ingestConcurrency(), 5) }, async () => {
      while (!budget.signal.aborted && !quota.exhausted) {
        const task = await claimWeatherTask();
        if (!task) break;
        const result = await weather.ingestCity(task.city, task.fromISO, task.toISO);
        const complete = result.ok && !result.summaryError;
        await finishWeatherTask(
          task,
          complete,
          budget.signal.aborted ? 'timeout' : quota.exhausted ? 'quota' : 'provider',
        );
        if (complete) completed++;
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
      quotaExhausted: quota.exhausted,
      openweatherCalls: weather.calls,
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
        openweatherCalls: weather.calls,
        ms: Date.now() - started,
        error: 'Weather worker failed before completion',
      });
    }
    throw error;
  } finally {
    budget.dispose();
  }
}
