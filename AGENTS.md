# Repository Guidelines

## Project Structure & Module Organization
- app/: Next.js App Router pages, routes, and layouts.
- components/: shared UI (PascalCase directories, e.g., components/DatePicker/).
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
- Sources: Google APIs and Ambee APIs. Store keys as `GOOGLE_API_KEY` and `AMBEE_API_KEY` in Vercel (and add to `.env.example`).
- Ingestion job: fetch latest readings by city/date and upsert into `pollen(city, date, count)`.
- Rate limits: implement retries with exponential backoff; respect provider quotas.
- Mapping: use Google (e.g., geocoding or other endpoints) to normalize city slugs; use Ambee for pollen metrics.

## Commit & Pull Request Guidelines
- Conventional Commits: feat:, fix:, chore:, docs:, refactor:, test:.
- PRs: clear description, linked issues (Closes #123), screenshots for UI, and test coverage notes.
- Keep changes scoped; update docs and .env.example when config changes.

## Deployment & Env
- Vercel: connect repo and set env vars in Project Settings.
- Local env: store secrets in .env.local; provide examples in .env.example.
- Useful: vercel env pull .env.local to sync environment.

## Cron & Logging
- Scheduling: use Vercel Cron to call an ingest endpoint (e.g., `/api/ingest`) on a fixed cadence (daily/hourly).
- Required logs: record both success and failure for each run.
  - Structured console logs (visible in Vercel Function Logs), e.g., `{ level: 'info'|'error', job: 'ingest', status, count, ts }`.
  - Optional persistence: `ingest_logs(id uuid, ts timestamptz, job text, status text, details jsonb)`; insert a row per run.
- Alerting: configure Vercel Alerts on function errors; include correlation IDs in logs to trace requests.
