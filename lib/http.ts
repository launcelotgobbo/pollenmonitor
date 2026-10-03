import { setTimeout as sleep } from 'node:timers/promises';

export type RetryOptions = {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  // Per-attempt deadline. Providers occasionally hold a socket open for
  // minutes, which would otherwise eat the whole function budget.
  timeoutMs?: number;
  // Called once per HTTP attempt, including retries, so quota accounting can
  // count what the provider actually saw rather than what the caller intended.
  onAttempt?: () => void | Promise<void>;
  signal?: AbortSignal;
};

export const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

// 429 is deliberately not retried: both Ambee and OpenWeather enforce daily
// quotas, so an immediate retry cannot succeed and only burns budget.
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);

function attemptSignal(init: RequestInit | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
}

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  {
    retries = 2,
    baseDelayMs = 500,
    maxDelayMs = 4000,
    timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
    onAttempt,
    signal,
  }: RetryOptions = {},
): Promise<Response> {
  const callerSignal =
    signal && init?.signal ? AbortSignal.any([signal, init.signal]) : (signal ?? init?.signal);
  const request = { ...init, signal: callerSignal };
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    callerSignal?.throwIfAborted();
    // Reservations must finish before the request starts, and a denied
    // reservation is not a transient provider failure to retry.
    const reservation = onAttempt?.();
    if (reservation) await reservation;
    callerSignal?.throwIfAborted();
    try {
      const res = await fetch(url, { ...request, signal: attemptSignal(request, timeoutMs) });
      if (!RETRYABLE_STATUSES.has(res.status) || attempt === retries) return res;
      lastError = new Error(`HTTP ${res.status}`);
      await res.body?.cancel();
    } catch (err) {
      // A caller-supplied abort is a decision, not a transient failure.
      if (callerSignal?.aborted || attempt === retries) throw err;
      lastError = err;
    }
    const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
    await sleep(backoff + Math.random() * backoff * 0.25, undefined, {
      signal: callerSignal ?? undefined,
    });
  }
  throw lastError;
}
