# NASA integration decisions and deviations

Every interpretation, and every deviation from the brief, is listed here.

## Scope and process

- **The Backend has been applied.** The repo already had
  `server/routes/nasa.ts`, `server/services/nasaCache.ts`, rate limiting and an
  app factory. Per section 9 the work was added there rather than in `server.ts`.
  New NASA code lives in `server/nasa/` (`schemas.ts`, `parsers.ts`,
  `upstream.ts`, `recorded.ts`, `snapshot.ts`).
- **The official challenge "Resources" list was not pasted** (the placeholder
  `[PASTE THE CHALLENGE RESOURCES LIST HERE]` was left as-is). No extra item
  could be cited. The one new dataset named by the brief itself — DONKI `FLR`
  solar flares (P1) — was added and fully integrated. Phase 7 (P2) was therefore
  not started: the second dataset depends on that list, and the brief marks P2
  as optional until everything above works.
- **Phase 0 audit was done against this repository**, not a fresh clone. The
  repo already contained the backend; the NASA problems listed in the brief were
  reproduced here (see the audit report in the conversation and the checklist
  below).

## Server and data

- **The bonus is recomputed, never copied.** `snapshot.bonus` is derived with
  `computeBonus` from the parsed fields (`sepCount`, `maxKpIndex`,
  `maxCmeSpeedKmS`, `cmeCount`), so a malformed upstream number can never leak
  into gameplay. Thresholds are unchanged (10 / 5 / 0).
- **Partial snapshot failure semantics.** `spaceWeather` is `null` if any of the
  CME/GST/SEP calls failed (the summary would otherwise show a wrong count);
  `flare` is `null` if FLR failed or returned none; `radiation` is `null` if
  RadLab failed. The remaining parts keep their real data and the snapshot stays
  `source: "live"`. The provenance entry for `DONKI CME/GST/SEP` is kept when at
  least one of the three succeeded; `spaceWeather: null` is the signal that a
  feed is missing.
- **An `unavailable` snapshot is not pinned for the whole day in memory.** A
  transient outage at 00:01 (as seen with DEMO_KEY) would otherwise spoil every
  later attempt that day. Live and recorded snapshots are pinned for the day;
  `unavailable` may be retried. The disk file is only written for live data.
- **Snapshot file reading is validated** with the same zod schema before use; a
  corrupt file is ignored rather than trusted.
- **DONKI deep links are normalised.** Real DONKI records link to
  `kauai.ccmc.gsfc.nasa.gov`, which no longer resolves. Those links are rewritten
  to the stable DONKI tool page (`https://ccmc.gsfc.nasa.gov/tools/DONKI/`). No
  data is changed, only a dead link is repaired. Non-https and malformed links
  are replaced the same way.
- **The OSDR `Authoritative Source URL` field is sometimes relative.** A real
  response returned `"OSD-319/"`. The parser rebuilds
  `https://osdr.nasa.gov/bio/repo/data/studies/<accession>` in that case.
- **OSDR parameters were verified against a live response**: `GET
  https://osdr.nasa.gov/osdr/data/search?term=...&size=4&type=cgene` returns
  `hits.total` and `hits.hits[]._source`, which is what the parser reads. Entries
  without an accession or title, or with an invalid accession, are dropped.
- **RadLab is cached 24 h and always labelled as a recording** ("Recorded on the
  ISS, 1 April 2022" built from `observedWindow`). The "Live OSDR RadLab API"
  label was removed from the UI.
- **RadLab TTL changed from 30 min to 24 h** because the window is historical and
  fixed. Space weather and flares cache 30 min; OSDR 6 h (was 30 min).
- **Recorded fallback sources.** The committed `src/content/nasa-recorded.json`
  is read once and validated; a missing or invalid file is treated as absent.
  `recordedOn` is the real capture time, and the snapshot built from it uses the
  recording's date as its `snapshotId`.
- **Neutral fallback shape.** Zeroed numbers, `null` latest records, an empty
  study list, `recommendedFlareBonus: 0` and a calm line. HTTP stays 200 because
  the client relies on it, but nothing is labelled live.
- **`NASA_FETCH_TIMEOUT_MS`** replaces the hard-coded 8 s and is bounded to
  1000–30000 ms; RadLab uses +1 s, capped at 9 s (unchanged upper bound).
- **`RADLAB_WINDOW_START` / `RADLAB_WINDOW_END`** are validated with
  `YYYY-MM-DDTHH:mm` and exposed as `observedWindow`.
- **`NASA_SNAPSHOT_DIR=''`** disables disk persistence (used by tests).
- **Rate limiting** reuses the existing `/api/nasa/*` limiter at 30 requests per
  minute. No logging of IPs, bodies or query strings was added.

## Frontend

- **Allowed-file rule vs. the Start button.** The brief's allow-list for
  `src/` omits `screens/title/TitleScreen.tsx`, but section 6.1 explicitly
  requires a "Checking NASA space weather..." state on the Start button. The only
  change there is the button label/disabled state and `void beginMission(...)`.
- **Round 6 / round 8 flare briefing without touching `RoundScreen`.** The brief
  allows `EventBanner` and `CrewComms` only. A small new component
  `src/ui/FlareBriefing.tsx` reads the pinned snapshot itself and is mounted in
  both `CrewComms` (so it is visible in the round 6 warning and on the round 8
  flare screen, where the crew panel is rendered) and `EventBanner`.
  `RoundScreen.tsx` was not modified.
- **Only the pinned snapshot may describe a run.** The flare briefing and the
  Mission Report render data only when `snapshot.snapshotId` equals the run's
  `pinnedSnapshotId`; an unpinned run shows nothing rather than today's data.
- **`goToTitle` resets the pin** to `none` / 0. The title screen's placeholder
  `gameState` is never played.
- **`nasaSnapshotId` is sent but not stored.** `syncRun` adds the optional field
  next to `liveFlareBonus`; the run route accepts it (strict schema) but replay
  only needs `liveFlareBonus`, so the store schema was not migrated.
- **Kid text lives in `src/content/nasaKid.json`.** Server and client both read
  it, so there is one source for every child-facing NASA sentence. Sentences are
  capped at 15 words; a test/script enforces it and bans frightening words.
- **The `note` field from DONKI remains in the API** for grown-up tooling, but no
  child-facing component renders it (enforced by `scripts/check-kid-text.ts`).
- **Science Library status labels** are "Live today", "Recorded <date>" and
  "Offline note", always icon plus word. The old "Live NASA Data" tab is now
  "Today's NASA Data", and the old "Cached benchmark" string is gone.
- **Grown-up gate**: no existing gate was found, so `src/ui/GrownUpLink.tsx` adds
  a minimal "Ask a grown-up: what is 7 + 8?" check with
  `rel="noopener noreferrer"` / `target="_blank"`. Every outbound NASA/CSA link
  goes through it.
- **Error copy** is a single calm line; no HTTP codes and no red messages. The
  old `weatherError` / `radLabError` / `osdrError` red text was removed.

## Facts

- **URLs were re-verified on 2026-11-15** and seven of nine were replaced or
  confirmed:
  - regolith: `nasa.gov/mission/artemis/` (404) → `nasa.gov/lunar-surface-technology`
  - radiation: dead `kauai.ccmc...` host → `ccmc.gsfc.nasa.gov/tools/DONKI/`
  - dust: `nasa.gov/humans-in-space/dust-mitigation/` (404) →
    `nasa.gov/humans-in-space/dust-an-out-of-this-world-problem`
  - radlab: RadLab GUI page returned 500 → `visualization.osdr.nasa.gov/`
  - CSA food: 404 → `asc-csa.gc.ca/eng/astronauts/living-in-space/eating-in-space.asp`
  - CSA STEM: 404 → `asc-csa.gc.ca/eng/youth-educators/`
- Claims were softened where the linked page does not support the exact number
  (e.g. the 40–45% oxygen figure is now attributed to regolith generally, and
  the CSA page is cited for eating/food in space rather than for specific
  greenhouse technology).
- `verifiedOn` and `sourceKind` were added to every fact (typed as optional in
  `ScienceFact`). CSA facts keep their CSA labels and are never called NASA.
- The attribution line was added to the Science Library footer, the docs and the
  README. No NASA logos or imagery were added.

## Testing

- Existing NASA tests were updated for the additive contract (new optional
  fields, `X-Cache: recorded`, neutral fallbacks). Old field names and values are
  still asserted unchanged.
- Test fixtures are either synthetic and clearly marked as such inside
  `server/__tests__/helpers.ts`, or live in the test file. **No synthetic data
  ships in the app.** `src/content/nasa-recorded.json` is produced only by
  `bun run record:nasa` and was not hand-written here.
- HTML stripping, very long text, wrong types, missing fields, empty arrays and
  unsafe links are covered by parser tests.

## Network reality in this environment

- `api.nasa.gov` was **not reachable** for verification: `curl` returned HTTP 429
  (`OVER_RATE_LIMIT`, DEMO_KEY quota) and Node's `fetch` failed outright. No DONKI
  response was captured, so the FLR fixture is synthetic and clearly marked.
- `osdr.nasa.gov` and `visualization.osdr.nasa.gov` responded normally. Their
  real response shapes were inspected and used to fix the OSDR URL repair and the
  RadLab parser; `verify:nasa` passed the RadLab and all four OSDR checks here.
- Because of that, `verify:nasa` exits non-zero on this machine: 27 of 32 checks
  pass (RadLab, all four OSDR searches, every `facts.json` URL, every stable
  server link, the production-key check), and the 5 failures are exactly the four
  DONKI endpoints plus the snapshot that depends on them. It is ready for the
  repo owner to run where NASA is reachable; nothing unverified is reported as
  passed.
- The URL checker retries once with `curl` when Node's `fetch` cannot connect,
  because link liveness is a property of the link (some hosts block Node's
  client); the DONKI API checks deliberately still use the server's own fetch so
  they reflect what the app will experience.
