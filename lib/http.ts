export type RetryOptions = {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
};

// 429 is deliberately not retried: both Ambee and OpenWeather enforce daily
// quotas, so an immediate retry cannot succeed and only burns budget.
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  { retries = 2, baseDelayMs = 500, maxDelayMs = 4000 }: RetryOptions = {},
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (!RETRYABLE_STATUSES.has(res.status) || attempt === retries) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (attempt === retries) throw err;
      lastError = err;
    }
    const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
    await sleep(backoff + Math.random() * backoff * 0.25);
  }
  throw lastError;
}
