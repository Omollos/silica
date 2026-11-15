# Backend decisions and deviations

Every choice where the brief allowed interpretation, plus every deviation from
it, is recorded here.

## Toolchain

- **Package manager: bun.** `bun.lock` was refreshed with `bun install`
  (bun 1.4.4) and `bun run lint`, `bun run test` (95 tests) and `bun run build`
  all pass; `node server.js` serves the built app and API from the bun-installed
  `node_modules`, including the `better-sqlite3` native binding. npm was used
  only while bun was unavailable and left no `package-lock.json`, so bun is the
  single source of truth for dependencies.
- **esbuild was bumped from `^0.25.0` to `^0.28.2`.** Vite 8 declares a peer
  range of `^0.27.0 || ^0.28.0`; the old pin made a clean install fail. The
  bundle target stays `node20`.
- **PostgreSQL (P2) is not implemented.** No `pg` dependency was added. When
  `DATABASE_URL` is set the server logs a warning and uses SQLite. The retention
  job, admin CSV and OpenAPI document are implemented.
- `better-sqlite3` installed successfully, so the `node:sqlite` fallback was not
  needed. `sqliteStore.ts` is the default; `memoryStore.ts` is used by tests.

## Build and configuration

- `start` is now `node server.js`; `build` produces `dist/` and `server.js`;
  `build:server` uses esbuild with `--packages=external`; `dev` stays
  `tsx server.ts`. `test` was added as `vitest run`.
- `vitest` remains in `dependencies` (unchanged). No runtime dependency was
  added beyond the requested `zod`, `better-sqlite3`, `express-rate-limit` and
  `helmet`. Supertest and its types are dev dependencies.
- `tsconfig.json` gained `"node"` in `types`, `esModuleInterop`,
  `resolveJsonModule` (for the package version) and excludes `server.js`.
- `TRUST_PROXY=true` is translated to one hop (`1`), because express-rate-limit
  rejects a fully permissive trust-proxy setting. Numeric hop counts pass through.
- `data/` and `server.js` were added to `.gitignore`; existing entries kept.

## API semantics

- **`MissionReport.runId`** is overwritten with the validated URL `runId` during
  replay. `startGame` generates a `Date.now()`-based id, which would otherwise
  make the stored report differ from the browser's report for the same run.
- **Progressive sync is union-based.** If a stored run is still playing, a
  shorter or stale payload never deletes stored rounds; the server replays and
  stores the union of stored and submitted choices. A choice that differs for an
  already stored round is `409 run_conflict`. Seed, difficulty or flare bonus
  changes on an existing run are also `run_conflict`; on a finished run they are
  `run_finished`.
- **Duplicate rounds in one body** are rejected as `400 invalid_body` (the brief
  does not define an error for them).
- **Oversized bodies return `400 invalid_body`**, not body-parser's native 413,
  because the test contract explicitly asks for 400.
- **`clientSummary.status` accepts `playing`** in addition to the three finished
  statuses, because the browser sends its current status on the first sync.
- **An identical resend of a finished run** returns `200` with the stored body
  and does not re-verify or overwrite the stored result.
- `GET /api/runs/:runId` returns the whole stored summary (including `choices`
  and `confirmed` timestamps) plus `report`. It never lists runs.
- The replay `round` in the PUT response is the engine's current round: the next
  round while playing, the final round after finishing.
- `roundsSurvived` for an in-progress run is the number of choices recorded.
- The server verifies disabled/offered choices with `getRoundView` because the
  engine's `submitChoice` neither rejects disabled choices nor reports unknown
  ones.

## Stats

- Only `verified = 1` runs count anywhere.
- `totals.runs` includes verified in-progress runs; `totals.completed`,
  outcomes, failure reasons, end rounds and choice popularity use completed runs
  only. This keeps a single early mission from appearing before it is finished
  while still showing classroom volume.
- `choicePopularity.share` is `count / completed verified runs` (not shares
  within a round), rounded to 4 decimals.
- Fewer than 5 completed runs returns `suppressed: true` with every value
  zeroed, as specified.
- Stats are cached for 60 seconds in memory and sent with
  `Cache-Control: public, max-age=60`.

## Security, privacy and NASA

- **CSP** allows `'self'` scripts in production; inline styles and
  `fonts.googleapis.com` fonts because `index.html` loads Google Fonts and
  Tailwind emits inline styles; `ws:`/`wss:` in `connect-src` for Vite's
  development HMR socket; `data:`/`blob:` images and blob workers for the 3D
  scene. No third-party scripts are allowed. Development additionally allows
  inline scripts because `@vitejs/plugin-react` injects its refresh preamble
  inline; production does not. The built app was loaded in headless Chrome to
  confirm the production CSP does not break rendering or the 3D canvas, and the
  dev server was checked the same way.
- **CORS** is opt-in: no CORS headers at all by default. When `CORS_ORIGINS` is
  set, only listed origins get `GET, PUT, OPTIONS` for same-origin-style use.
- **Rate limiting** is in-memory per process and disabled only through the
  dependency-injected test configuration. `Retry-After` is set explicitly.
- **Retention** uses `COALESCE(completed_at, updated_at) < cutoff`, so
  in-progress runs that were never finished also expire.
- **Admin CSV** exports every finished run, verified or not, with a `verified`
  column and no identifiers. It is protected by a constant-time Bearer compare
  and disabled (404) when `ADMIN_TOKEN` is unset.
- **NASA caching**: DONKI 10 minutes, RadLab/OSDR 30 minutes (unchanged),
  response `Cache-Control` fixed at 60 seconds for browsers. A stale entry is
  served on refresh failure; it is never relabelled as fresh and the next
  request retries upstream. Request coalescing is per cache key.
- `schema.ts` is the source of truth for SQL; `schema.sql` is the documentation
  copy and a test fails if the two drift.

## Frontend glue

- Changes under `src/` are limited to `src/api/runsClient.ts`, the two sync calls
  in `src/store/gameStore.ts` (plus the import) and the flush hook in
  `src/main.tsx`.
- The 5-second timeout uses `AbortController`; 4xx responses are never queued,
  5xx/network failures are, at most 20 entries, keyed by `runId`.
- `localStorage` is accessed behind `try/catch` and availability checks, so
  private mode cannot break the game.
