# NASA integration operations

## Get a free NASA key

1. Open <https://api.nasa.gov/> and fill in the short sign-up form.
2. The key arrives by email immediately (no payment, no card).
3. Put it in `.env` (never commit `.env`):

```bash
NASA_API_KEY="your-key-here"
```

The key is only read by the server. It is never sent to the browser, and the
browser never calls NASA directly.

### DEMO_KEY limits

`DEMO_KEY` works without signing up but is limited to roughly **30 requests per
hour and 50 per day per IP** on `api.nasa.gov`. The server makes four DONKI calls
per UTC day for the snapshot plus one per 30-minute library refresh, so DEMO_KEY
runs out quickly. The server logs a warning when `NODE_ENV=production` and the
key is still `DEMO_KEY`.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `NASA_API_KEY` | `DEMO_KEY` | Server-side NASA Open APIs key |
| `NASA_FETCH_TIMEOUT_MS` | `8000` | Upstream timeout (1000–30000 ms); RadLab uses +1 s |
| `NASA_SNAPSHOT_DIR` | `./data/nasa` | Snapshot disk cache; empty string disables disk use |
| `RADLAB_WINDOW_START` | `2022-04-01T23:00` | Real ISS recording window start (UTC) |
| `RADLAB_WINDOW_END` | `2022-04-02T01:05` | Real ISS recording window end (UTC) |

`data/` is gitignored, so snapshots never reach the repository.

## Recording real data for offline demos

```bash
bun run record:nasa
```

This fetches today's DONKI CME/GST/SEP/FLR, the RadLab window and one OSDR
search for each topic, validates everything with the same schemas the server
uses, and writes `src/content/nasa-recorded.json` with a `recordedOn`
timestamp. Commit that file. The script writes nothing if any call fails, so a
half-recorded file cannot ship.

When the file is absent the app still works: it uses the neutral fallback. The
file must only ever be produced by this script, never edited by hand. Restart
the server after recording so the file is read again (it is cached in memory
for the process lifetime).

## Verifying before a demo

```bash
bun run verify:nasa      # real network, real key; exits non-zero on any failure
bun run check:kid-text    # sentence length and banned words in kid copy
bun run test              # no network needed
bun run lint
```

`verify:nasa` checks every DONKI endpoint, the RadLab rows, the four OSDR
searches, every `facts.json` URL, the stable links returned by the server, that
the key is not `DEMO_KEY` in production, and that the daily snapshot builds. If
this machine cannot reach NASA, the script says so in its own output — it never
reports an unverified item as passed.

## Cache and TTL table

| Response | Upstream calls | TTL | Disk |
| --- | --- | --- | --- |
| `/api/nasa/snapshot` | 4 DONKI + 1 RadLab | 24 h (one UTC day) | `snapshot-YYYY-MM-DD.json` |
| `/api/nasa/space-weather` | 3 DONKI | 30 min | no |
| `/api/nasa/flares` | 1 DONKI | 30 min | no |
| `/api/nasa/radlab` | 1 RadLab | 24 h | no |
| `/api/nasa/osdr` | 1 OSDR | 6 h | no |

Concurrent cache misses share a single upstream call. Each response reports
`X-Cache: hit | miss | stale | recorded | fallback`.

## When NASA is down

1. The last good result for that key is served as `X-Cache: stale`.
2. If there is none, the committed real recording is served with
   `source: "recorded"` and its real date (`recordedOn`, `snapshotId`).
3. If there is no recording either, a neutral payload is served: HTTP 200,
   `source: "fallback"`, every number zeroed or null and bonus 0.

For the snapshot specifically, an all-upstream failure serves the most recent
saved snapshot file as `source: "recorded"`, then the committed recording, then
`source: "unavailable"` with `bonus: 0`.

Children see at most one calm sentence ("NASA's news feed is resting right
now."). The game itself never waits more than two seconds for NASA when the
mission starts, and plays normally at bonus 0 if data does not arrive.

## Troubleshooting

- `verify:nasa` reports `fetch failed` for every DONKI call: the process cannot
  reach `api.nasa.gov` (corporate proxy, offline container, or a Node build
  without outbound TLS). Test with `curl https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY`.
  The game degrades to recorded/neutral data in that case.
- `HTTP 429` from `api.nasa.gov`: DEMO_KEY quota exhausted. Wait an hour or use a
  free personal key.
- RadLab returns no rows: the fixed window is historical; check
  `RADLAB_WINDOW_START` / `RADLAB_WINDOW_END` still return data in the RadLab
  portal (<https://visualization.osdr.nasa.gov/>).
- OSDR study links look wrong: some real responses return a relative
  `Authoritative Source URL` such as `OSD-319/`; the parser repairs these to
  `https://osdr.nasa.gov/bio/repo/data/studies/<accession>`.
