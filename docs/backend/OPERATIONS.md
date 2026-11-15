# Operating Silica Station

## Environment variables

All are optional and additive; existing frontend variables are unchanged.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` | `development` mounts Vite; `production` serves `dist/` |
| `NASA_API_KEY` | `DEMO_KEY` | Server-side NASA key; never sent to the browser |
| `DATA_DIR` | `./data` | SQLite directory (`silica.db`) |
| `CORS_ORIGINS` | empty | Comma-separated allow-list; empty = same-origin only |
| `TRUST_PROXY` | `false` | `true` (one hop) or a hop count for Cloud Run/load balancers |
| `RETENTION_DAYS` | `365` | Daily deletion cutoff for anonymous runs |
| `ADMIN_TOKEN` | unset | Enables `GET /api/admin/export.csv`; unset = 404 |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error`, `silent` |
| `DATABASE_URL` | unset | P2 only; not implemented, SQLite is used and a warning is logged |

Copy `.env.example` to `.env` for local development. Do not commit `.env`.

## Run locally

```bash
bun install        # the only supported package manager
bun run dev        # tsx server.ts, Vite middleware, http://localhost:3000
```

The game and API share one origin, so no proxy configuration is needed.

## Build and start

```bash
bun run lint       # tsc --noEmit
bun run test       # vitest run
bun run build      # dist/ + server.js (esbuild bundle)
bun run start      # node server.js, serves dist/ and the API
```

`server.js` bundles `server.ts` together with `src/engine` and the scenario JSON.
Runtime packages stay external. `bun run clean` removes `dist/` and `server.js`.

## Deploying

1. Set `NODE_ENV=production`, a real `NASA_API_KEY`, and (if needed) `PORT`,
   `DATA_DIR`, `TRUST_PROXY`, `ADMIN_TOKEN`.
2. Build, then start with `node server.js`.
3. Put one instance behind HTTPS. The app is same-origin; do not enable CORS
   unless you split the frontend onto another origin.

### Important: ephemeral container disks (AI Studio / Cloud Run)

This repository was scaffolded in Google AI Studio. There, the container
filesystem is typically **ephemeral**: it can reset on every redeploy and when
the service scales to zero, and several instances each get their own disk. A
SQLite file in `DATA_DIR` is then lost or split across instances.

Options:

- **Single instance + persistent volume.** Mount a disk at `DATA_DIR`, run
  exactly one instance, and set `TRUST_PROXY` correctly. Accept that redeploys
  without the volume keep losing data.
- **Postgres (`DATABASE_URL`).** The P2 `postgresStore` is not implemented in
  this release; when it is, set `DATABASE_URL` and several instances can share it.
- **Do not persist at all.** This is the safest default for a hackathon demo.
  The game works fully without the backend: if `/api/runs` and `/api/stats` are
  blocked or the disk resets, children still play, and the browser keeps at most
  20 unsent runs in `localStorage` for a later retry.

None of these options affects gameplay. The backend is optional by design.

## Backups

- SQLite: stop the server (or use `sqlite3 data/silica.db ".backup backup.db"`),
  copy `silica.db` plus any `-wal`/`-shm` files, then restart.
- Retention deletion is irreversible. Lower `RETENTION_DAYS` only deliberately.
- The data contains no personal information, so backups have no special privacy
  handling beyond normal access control.

## Reading the logs

One JSON object per line on stdout:

```json
{"ts":"2026-11-15T00:00:00.000Z","level":"info","msg":"request","method":"PUT","path":"/api/runs/run_1_ab12cd","status":200,"ms":4.2,"requestId":"…"}
```

- Startup warnings flag `NODE_ENV=production` with `DEMO_KEY` and an ignored
  `DATABASE_URL`.
- There are no IP addresses, request bodies, query strings or user agents.
- `LOG_LEVEL=debug` adds nothing identifying; `silent` disables output.
- The daily retention sweep logs how many expired runs it removed.

## Health checks

`GET /api/health` returns `200` with `{ status: "ok", db: "ok" }`, or `503` when
the store check fails. Point the platform probe at it.

## Shutdown

`SIGTERM` and `SIGINT` stop accepting requests, close the SQLite database and
exit; a 10-second force-exit guards against a hung connection.
