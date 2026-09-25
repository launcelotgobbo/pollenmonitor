// Rebuild pollen_daily from pollen_readings_hourly, one calendar month per
// statement so a long history does not run as a single giant transaction.
//
//   npm run db:backfill-pollen-daily                 whole history
//   npm run db:backfill-pollen-daily -- 2026-01-01   from that day onward
//
// Idempotent: days that already have a row are rewritten with the same values.
// Uses POSTGRES_URL_NON_POOLING if set, otherwise POSTGRES_URL.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(root, '.env.local') });
dotenv.config();
if (process.env.POSTGRES_URL_NON_POOLING) {
  process.env.POSTGRES_URL = process.env.POSTGRES_URL_NON_POOLING;
}

function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function nextMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error('Set POSTGRES_URL (or POSTGRES_URL_NON_POOLING)');
  }
  // The pool reads POSTGRES_URL when lib/db is first evaluated.
  const { query } = await import('@/lib/db');
  const { refreshPollenDaily } = await import('@/lib/pollen-daily');

  const startArg = process.argv[2];
  const { rows } = await query<{ first: string | null; last: string | null }>(
    `SELECT min(ts)::text AS first, max(ts)::text AS last FROM pollen_readings_hourly`,
  );
  if (!rows[0]?.first || !rows[0]?.last) {
    console.log('pollen_readings_hourly is empty; nothing to backfill.');
    return;
  }
  const first = startArg ? new Date(`${startArg}T00:00:00Z`) : new Date(rows[0].first);
  const last = new Date(rows[0].last);
  if (Number.isNaN(first.getTime())) throw new Error(`Invalid start date: ${startArg}`);

  let total = 0;
  const started = Date.now();
  for (let from = monthStart(first); from <= last; from = nextMonth(from)) {
    const chunkStart = from < first ? first : from;
    const chunkEnd = new Date(Math.min(nextMonth(from).getTime() - 1, last.getTime()));
    const t0 = Date.now();
    const result = await refreshPollenDaily({ from: chunkStart, to: chunkEnd });
    total += result.rows;
    console.log(`${result.from} .. ${result.to}: ${result.rows} city-days in ${Date.now() - t0} ms`);
  }
  console.log(`Backfilled ${total} city-day rows in ${Math.round((Date.now() - started) / 1000)} s.`);
}

main().catch((e) => {
  console.error('Backfill failed:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
