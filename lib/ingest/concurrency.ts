export const DEFAULT_INGEST_CONCURRENCY = 5;

export function ingestConcurrency(): number {
  const parsed = Number(process.env.INGEST_CONCURRENCY);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : DEFAULT_INGEST_CONCURRENCY;
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) break;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
