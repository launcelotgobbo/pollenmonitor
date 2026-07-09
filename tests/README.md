# Tests

- Runner: Node.js built-in test runner via `tsx` - run with `npm test`.
- Location: `tests/**/*.test.ts`, mirroring the `app`/`lib` structure.
- Path aliases (`@/lib/...`) resolve through tsconfig paths.
- Provider clients (Ambee, OpenWeather) are tested by stubbing `globalThis.fetch`; tests must not hit the network or a live database.
- E2E: Playwright under `tests/e2e` as `*.spec.ts` (not yet configured).
