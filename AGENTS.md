# Repository Guidelines

## Project Structure & Module Organization
- app/: Next.js App Router pages, routes, and layouts.
- components/: shared UI (e.g., components/CityPicker/).
- lib/: client/server utilities (e.g., lib/db.ts for Vercel DB client).
- public/: static assets.
- tests/: unit and e2e tests (mirrors app/components structure).
- .github/workflows/: CI for lint, typecheck, build, tests.

## Build, Test, and Development Commands
- npm install: install dependencies.
- npm run dev: start Next.js locally at http://localhost:3000.
- npm run build: production build with Next.js.
- npm start: run the production server locally.
- npm run lint && npm run format: ESLint and Prettier checks/fixes.
- npm test: run unit tests (node:test via tsx, `tests/**/*.test.ts`).
- npm run test:db: run database integration tests (`tests/integration/*.dbtest.ts`) against a throwaway local Postgres. Requires `POSTGRES_TEST_URL` (localhost only; the suite drops and rebuilds `public`), e.g. `docker run --rm -d --name pm-test-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pollenmonitor_test -p 55432:5432 postgres:17-alpine` then `POSTGRES_TEST_URL='postgres://postgres:postgres@localhost:55432/pollenmonitor_test?sslmode=disable' npm run test:db`. CI runs the same suite against a Postgres 17 service.
- npx playwright test: run e2e tests (if Playwright configured).

## Coding Style & Naming Conventions
- TypeScript-first. Server Components by default; Client Components with 'use client'.
- Naming: components PascalCase, hooks use camelCase with usePrefix, files kebab-case.
- Import paths absolute from src root when configured (e.g., @/lib/db).
- ESLint (next/core-web-vitals) and Prettier; fix before commit.

## Testing Guidelines
- Unit: node:test under tests/ with files *.test.ts; database integration tests under tests/integration with files *.dbtest.ts (see `npm run test:db`).
- E2E: Playwright under tests/e2e with files *.spec.ts.
- Coverage: target ≥ 80%; include data fetching and error states.
- Add tests with new features and bug fixes.

## Feature Notes (Pollen Monitor)
- Date lookup: GET /api/pollen?date=YYYY-MM-DD; UI in app/date/page.tsx with a date picker.
- City history: GET /api/pollen?city={slug}; UI in app/city/[city]/page.tsx with charts.
- Data: use Vercel Postgres (preferred) via lib/db.ts; env keys: DATABASE_URL, POSTGRES_PRISMA_URL (if Prisma).
- Caching: revalidate historical queries (e.g., export const revalidate = 3600) and bypass cache for today.

## Data Sources & Ingestion
- Source: Ambee API (`AMBEE_API_KEY`). Ensure the key is available in Vercel and local `.env` files.
- Quota tracking: set `AMBEE_DAILY_QUOTA` (default 200) so ingest logs capture Ambee call counts and warn when exceeding the plan.
- Ingestion job: fetch latest readings by city/date and upsert hourly Ambee measurements (`pollen_readings_hourly`).
- Rate limits: `fetchWithRetry` (`lib/http.ts`) retries 5xx with exponential backoff, never 429, and aborts any attempt after 15 s. Pass `onAttempt` so quota counters see every HTTP attempt, retries included.
- Mapping: use the geojson seed file to normalize city slugs; Ambee supplies pollen metrics.
- Weather: OpenWeather One Call 4.0 daily timeline (`data/4.0/onecall/timeline/1day`, one call per city per run) plus the free Air Pollution history API. The timeline requires the "One Call by Call" subscription; 3.0 is deprecated and cannot be subscribed to anymore.

## Commit & Pull Request Guidelines
- Conventional Commits: feat:, fix:, chore:, docs:, refactor:, test:.
- PRs: clear description, linked issues (Closes #123), screenshots for UI, and test coverage notes.
- Keep changes scoped; update docs and .env.example when config changes.

## Deployment & Env
- Vercel: connect repo and set env vars in Project Settings.
- Local env: store secrets in .env.local; provide examples in .env.example.
- Useful: vercel env pull .env.local to sync environment.
 
## Operations
- Migrations: `npm run db:migrate` applies every `migrations/NNN_name.sql` not yet recorded in `schema_migrations`, each in its own transaction, in version order, under an advisory lock so concurrent runs cannot double-apply. It stores a sha256 of each file and refuses to run if an applied file has been edited; add a new migration instead. `npm run db:migrate -- --status` lists pending/applied/drifted files without changing anything. `npm run db:migrate -- --baseline` records every file as applied without executing it, for databases that were migrated by hand before the runner existed.
- Manual ingest (hourly Ambee):
  - Local: `curl -X POST -H "x-ingest-token: $INGEST_TOKEN" "http://localhost:3000/api/ingest"`
  - Options: `?city=slug` to target one city, `?hours=48` to adjust window, `?dry=true` for a dry run.
- Cron (Vercel): daily ingest at 1:00 AM `America/Los_Angeles` (DST-aware). `vercel.json` invokes at 08:00 and 09:00 UTC; the route skips whichever invocation is not 1:00 AM Pacific.
  - Auth: set `CRON_SECRET` in every environment so Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Manual triggers use a header, never a query string: `curl -H "x-ingest-token: $INGEST_TOKEN" ".../api/cron/daily-ingest"`.
  - Logs: Each run is recorded in `ingest_logs` with counts + duration. Stack traces stay in function logs and are not persisted.
- Inspect runs: `curl -H "x-ingest-token: $INGEST_TOKEN" "http://localhost:3000/api/ingest-logs"` (operator-only, not a public endpoint). Filters: `?job=daily-ingest|manual-ingest`, `?status=success|partial|failure`, `?limit=1..200`.
- Health: `GET /api/health` (public, no auth) returns 200 when the DB answers and the daily ingest, pollen, and weather data are fresh, 503 otherwise. `.github/workflows/health-monitor.yml` probes it every 30 minutes and fails the run (GitHub emails the workflow's last committer) on anything but 200; the site header and map show the same report as a "Data current / Data delayed" badge (`components/DataFreshness.tsx`).
- Retention: the daily cron prunes `pollen_forecast_hourly` older than 7 days and `ambee_usage_logs` / `ingest_logs` older than 90 days after each run (`pruneOperationalData` in `lib/db.ts`). `pollen_readings_hourly` and `weather_daily` are kept indefinitely.
- Local git hook: run `npm run setup:hooks` once to enforce `npm run build` on each commit (set `SKIP_PRECOMMIT_BUILD=1` to bypass when needed).

## Cron & Logging
- Scheduling: Vercel Cron calls `/api/cron/daily-ingest` at both UTC offsets needed for 1:00 AM Pacific; optionally use ad-hoc `/api/ingest` triggers for backfills.
- Required logs: record both success and failure for each run.
  - Structured console logs (visible in Vercel Function Logs), e.g., `{ level: 'info'|'error', job: 'ingest', status, count, ts }`.
  - Persistence: `ingest_logs` captures status + summary JSON.
- Alerting: configure Vercel Alerts on function errors; include correlation IDs in logs to trace requests.
