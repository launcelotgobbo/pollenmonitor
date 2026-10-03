// Leave a minute for in-flight database writes and durable completion logs
// before Vercel's 300 second hard limit.
export const INGEST_BUDGET_MS = 240_000;

export function ingestBudget(ms = INGEST_BUDGET_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Ingest time budget exhausted')), ms);
  timer.unref();
  return { signal: controller.signal, dispose: () => clearTimeout(timer) };
}
