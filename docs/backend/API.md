# Silica Station backend API

All routes are JSON and live on the same origin as the game. In development
(`tsx server.ts`) Express mounts Vite as middleware; in production (`node
server.js`) it serves `dist/`. The frontend calls relative URLs such as
`/api/nasa/space-weather`, so **no CORS or proxy configuration is needed** for
`bun run dev` or production. CORS headers appear only when `CORS_ORIGINS` is set.

Default local base URL: `http://localhost:3000`.

## Error shape

Every failure uses:

```json
{ "error": { "code": "invalid_body", "message": "Request body is invalid." } }
```

| HTTP | code | When |
| --- | --- | --- |
| 400 | `invalid_body` | Unknown body keys, free text, bad types, bad `runId`, oversized body (> 20 KB), duplicate rounds |
| 401 | `unauthorized` | Missing/invalid admin bearer token (P2) |
| 404 | `not_found` | Unknown run or unknown `/api/*` route (also admin route when `ADMIN_TOKEN` is unset) |
| 409 | `run_conflict` | A stored round would change, or seed/difficulty/flare bonus differs |
| 409 | `run_finished` | Any change to a finished run |
| 422 | `unknown_choice` | The choice id is not offered in that round |
| 422 | `illegal_choice` | The choice exists but is disabled (unaffordable) |
| 422 | `round_mismatch` | The choice's round is not the state's current round |
| 422 | `choices_after_end` | A choice follows the round where the run ended |
| 429 | `rate_limited` | Rate limit exceeded; includes `Retry-After` |
| 500 | `server_error` | Unexpected failure; no stack traces are returned |

## GET /api/health

`200` when the store is reachable, `503` otherwise.

```bash
curl http://localhost:3000/api/health
```

```json
{ "status": "ok", "version": "0.0.0", "db": "ok", "uptimeSeconds": 42 }
```

## PUT /api/runs/:runId

The only write endpoint. `runId` must match `^[A-Za-z0-9_-]{6,64}$` and is
supplied by the client (it is the showdown id already used by the game).

Body (strict zod schema; unknown keys rejected; 20 KB limit):

```json
{
  "seed": 1,
  "difficulty": "standard",
  "liveFlareBonus": 5,
  "choices": [
    { "round": 1, "choiceId": "dirt_air" },
    { "round": 2, "choiceId": "heat_on" }
  ],
  "clientSummary": { "status": "playing", "round": 3, "power": 55, "oxygen": 73, "health": 100 }
}
```

- `seed`: integer 0..2147483647
- `difficulty`: `cadet` | `standard` | `commander`
- `liveFlareBonus`: exactly `0`, `5` or `10` (anything else is `400`)
- `choices`: at most 12 entries; rounds 1..12; `choiceId` is a lowercase identifier
- `clientSummary`: optional; every field inside it is optional

The server replays the run with the shared engine (`src/engine`) and stores only
its own numbers. It never stores the client's results.

Response (`201` first write, `200` idempotent/extension):

```json
{
  "runId": "run_1_ab12cd",
  "verified": true,
  "status": "playing",
  "round": 3,
  "report": null,
  "mismatch": []
}
```

When the run is finished, `report` is the server-built `MissionReport` from
`src/types.ts` and `round` is the final round.

Idempotency and conflicts:

- Identical resend: `200` with the stored result (never re-verified or overwritten).
- Same or longer choice list: `200`, the stored run is extended.
- A different choice for a stored round, or a different seed/difficulty/bonus on a
  stored run: `409 run_conflict`.
- Any change to a finished run: `409 run_finished`.
- Short/stale payloads never delete stored rounds; the server keeps the union.

```bash
curl -X PUT http://localhost:3000/api/runs/run_demo_123456 \
  -H 'Content-Type: application/json' \
  -d '{"seed":1,"difficulty":"standard","liveFlareBonus":0,"choices":[{"round":1,"choiceId":"dirt_air"}]}'
```

### Replay rules

1. `startGame(seed, difficulty, liveFlareBonus)` from `src/engine`.
2. For each choice in ascending round order: the round must equal the current
   round; the choice must be offered by `getRoundView` and not disabled.
3. `submitChoice` is applied; replay stops at the round where the run ends.
4. If finished, `buildReport` produces the authoritative mission report.
5. The report's `runId` is set to the URL `runId`.

Disabled choices are enforced by the server because the engine's
`submitChoice` does not reject them.

## GET /api/runs/:runId

`404` unless the run exists. Returns the stored summary and, when finished, the
server-built report. There is intentionally no endpoint that lists runs.

```bash
curl http://localhost:3000/api/runs/run_demo_123456
```

```json
{
  "runId": "run_demo_123456",
  "seed": 1,
  "difficulty": "standard",
  "liveFlareBonus": 0,
  "status": "playing",
  "failureReason": null,
  "roundsSurvived": 2,
  "score": null,
  "finalPower": null,
  "finalOxygen": null,
  "finalHealth": null,
  "finalMoonDirt": null,
  "finalShield": null,
  "verified": true,
  "mismatch": [],
  "startedAt": "2026-11-15T00:00:00.000Z",
  "updatedAt": "2026-11-15T00:01:00.000Z",
  "completedAt": null,
  "choices": [
    { "round": 1, "choiceId": "dirt_air" },
    { "round": 2, "choiceId": "heat_on" }
  ],
  "report": null
}
```

## GET /api/stats

Anonymous aggregates, cached for 60 seconds (`Cache-Control: public, max-age=60`).

```bash
curl http://localhost:3000/api/stats
```

```json
{
  "generatedAt": "2026-11-15T00:00:00.000Z",
  "minSample": 5,
  "suppressed": false,
  "totals": { "runs": 7, "completed": 6 },
  "outcomes": { "won": 2, "partial": 1, "lost": 3 },
  "failureReasons": { "oxygen": 2, "health": 1 },
  "averageScore": 39,
  "byDifficulty": {
    "cadet": { "runs": 2, "won": 1, "partial": 0, "lost": 1 },
    "standard": { "runs": 2, "won": 1, "partial": 0, "lost": 1 },
    "commander": { "runs": 2, "won": 0, "partial": 1, "lost": 1 }
  },
  "endRound": [{ "round": 12, "count": 3 }],
  "choicePopularity": [
    { "round": 1, "choiceId": "dirt_air", "count": 4, "share": 0.6667 }
  ]
}
```

- Only `verified = 1` runs are counted.
- When fewer than 5 runs are complete, `suppressed` is `true` and every value is zeroed.
- `totals.runs` counts verified runs including in-progress ones; `totals.completed`,
  outcomes, failure reasons, end rounds and choice popularity use completed runs only.
- `share` = choices for that id in that round ÷ completed verified runs.

## NASA routes

The original three URLs and their old fields are unchanged; new fields are
additive and optional. Full data documentation lives in
[docs/nasa/DATA_SOURCES.md](../nasa/DATA_SOURCES.md).

```bash
curl http://localhost:3000/api/nasa/snapshot
curl http://localhost:3000/api/nasa/space-weather
curl http://localhost:3000/api/nasa/flares
curl http://localhost:3000/api/nasa/radlab
curl 'http://localhost:3000/api/nasa/osdr?topic=bone'
```

Each response carries:

- `X-Cache: hit | miss | stale | recorded | fallback`
- `Cache-Control: public, max-age=60`
- `source: "live" | "recorded" | "fallback"` in the body, plus optional
  `recordedOn`, `note` and `fetchedAt` so the UI can label the data truthfully.

Behaviour:

- `GET /api/nasa/snapshot` is computed once per UTC day (four DONKI calls plus the
  fixed RadLab recording) and then served unchanged from memory and
  `data/nasa/snapshot-YYYY-MM-DD.json`. `bonus` is 0, 5 or 10 using the existing
  thresholds.
- Space weather and flares are cached 30 minutes; RadLab 24 hours (it is a fixed
  historical recording); OSDR 6 hours.
- Concurrent cache misses share one upstream call.
- If an upstream call fails and a previous good payload exists, that payload is
  served with `X-Cache: stale`. Otherwise the committed real recording
  (`src/content/nasa-recorded.json`, `source: "recorded"`) is used. With no
  recording, a neutral payload with zeroed numbers, `recommendedFlareBonus: 0`
  and `source: "fallback"` is served.
- Upstream timeouts default to 8 s (`NASA_FETCH_TIMEOUT_MS`) for DONKI/OSDR and
  9 s for RadLab.
- `NASA_API_KEY` never reaches the browser; the server defaults to `DEMO_KEY` and
  logs a warning when that happens in production.

`topic` accepts `bone`, `radiation`, `immune`, `food`; anything else becomes `bone`.
The RadLab response includes `observedWindow: { start, end }` for its real 2022
recording window; it is never labelled live.

## P2: GET /api/admin/export.csv

Disabled with `404` unless `ADMIN_TOKEN` is set. Requires
`Authorization: Bearer <ADMIN_TOKEN>` (constant-time comparison). Exports
finished runs as CSV with no identifiers.

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/api/admin/export.csv -o silica-runs.csv
```

## Rate limits

| Scope | Limit |
| --- | --- |
| PUT `/api/runs/*` | 30 per minute per client |
| GET `/api/runs/*`, GET `/api/stats` | 60 per minute per client |
| `/api/nasa/*` | 30 per minute per client |

The in-memory client key is used only for limiting; it is never written to disk
or logs.
