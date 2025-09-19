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
- npm test: run unit tests (Jest + React Testing Library).
- npx playwright test: run e2e tests (if Playwright configured).

## Coding Style & Naming Conventions
- TypeScript-first. Server Components by default; Client Components with 'use client'.
- Naming: components PascalCase, hooks use camelCase with usePrefix, files kebab-case.
- Import paths absolute from src root when configured (e.g., @/lib/db).
- ESLint (next/core-web-vitals) and Prettier; fix before commit.

## Testing Guidelines
- Unit: Jest + React Testing Library under tests/unit with files *.test.ts(x).
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
- Rate limits: implement retries with exponential backoff; respect provider quotas.
- Mapping: use the geojson seed file to normalize city slugs; Ambee supplies pollen metrics.

## Commit & Pull Request Guidelines
- Conventional Commits: feat:, fix:, chore:, docs:, refactor:, test:.
- PRs: clear description, linked issues (Closes #123), screenshots for UI, and test coverage notes.
- Keep changes scoped; update docs and .env.example when config changes.

## Deployment & Env
- Vercel: connect repo and set env vars in Project Settings.
- Local env: store secrets in .env.local; provide examples in .env.example.
- Useful: vercel env pull .env.local to sync environment.
 
## Operations
- Migrations: run `npm run db:migrate` locally or execute `migrations/001_init.sql` in your DB once.
- Manual ingest (hourly Ambee):
  - Local: `curl -X POST -H "x-ingest-token: $INGEST_TOKEN" "http://localhost:3000/api/ingest"`
  - Options: `?city=slug` to target one city, `?hours=48` to adjust window, `?dry=true` for a dry run.
- Cron (Vercel): daily function call to `/api/cron/daily-ingest` (already wired via `vercel.json`).
  - Auth: Vercel Cron includes `x-vercel-cron`. Manual triggers can use `/api/cron/daily-ingest?token=$INGEST_TOKEN`.
  - Logs: Each run is recorded in `ingest_logs` with counts + duration.
- Local git hook: run `npm run setup:hooks` once to enforce `npm run build` on each commit (set `SKIP_PRECOMMIT_BUILD=1` to bypass when needed).

## Cron & Logging
- Scheduling: use Vercel Cron to call `/api/cron/daily-ingest?days=5` (already configured) and optionally ad-hoc `/api/ingest` triggers for backfills.
- Required logs: record both success and failure for each run.
  - Structured console logs (visible in Vercel Function Logs), e.g., `{ level: 'info'|'error', job: 'ingest', status, count, ts }`.
  - Persistence: `ingest_logs` captures status + summary JSON.
- Alerting: configure Vercel Alerts on function errors; include correlation IDs in logs to trace requests.
