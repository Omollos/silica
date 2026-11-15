# NASA and CSA data sources

Every number in Silica Station that claims to come from NASA comes from one of
the sources below. Nothing is hand-written: the same zod schemas validate live
responses, recorded responses and test fixtures, and the app never shows a
number it could not parse.

## Datasets

| Dataset | Provider and endpoint | Parameters | What the game does with it | Update rate / TTL | Fallback behaviour |
| --- | --- | --- | --- | --- | --- |
| Space weather: CME, GST, SEP | NASA DONKI via `https://api.nasa.gov/DONKI/CME`, `/GST`, `/SEP` | `startDate` / `endDate` = last 28 UTC days, `api_key` = server-side `NASA_API_KEY` | Sets today's space weather (`Quiet` / `Elevated` / `Storm Watch`) and the flare bonus 0, 5 or 10 used in round 8 | Once per UTC day in `/api/nasa/snapshot`; the library route caches 30 min | Stale last good result → committed recording (`source: "recorded"`) → neutral zeros (`source: "fallback"`, bonus 0) |
| Solar flares (FLR) | NASA DONKI `https://api.nasa.gov/DONKI/FLR` | Same 28-day window | The strongest real flare (class C/M/X) appears in the round 6 warning, the round 8 flare screen and the Mission Report. Presentation only: it does not change damage | Once per UTC day in the snapshot; the `/api/nasa/flares` route caches 30 min | Same three-step fallback; `flare: null` when nothing is known |
| RadLab ISS dosimetry | NASA OSDR RadLab API, `https://visualization.osdr.nasa.gov/radlab/api/` | `spacecraft=ISS`, `instrument=DosTel`, fixed window `RADLAB_WINDOW_START`..`RADLAB_WINDOW_END` (default `2022-04-01T23:00`..`2022-04-02T01:05`), `absorbed_dose_rate`, `flux`, `format=json` | Teaches that radiation is measurable: real ISS dose readings in the Science Library and the crew's radiation note | Fixed historical recording, cached 24 hours | `source: "recorded"` from the committed file, otherwise neutral (`sampleCount: 0`) |
| OSDR studies | NASA OSDR search, `https://osdr.nasa.gov/osdr/data/search` | `term` per topic, `size=4`, `type=cgene` | Curated one-line kid summary per topic; real study titles only inside the "For grown-ups" block | 6 hours | Committed recording per topic, otherwise an empty list with a calm line |
| Static facts | NASA and CSA web pages listed in `src/content/facts.json` | One verified URL per fact (`verifiedOn`, `sourceKind`) | Offline science library cards | Shipped with the app | None needed; facts are offline text |
| CSA lunar food and youth resources | Canadian Space Agency pages | — | CSA tab and two facts; always labelled CSA, never NASA | Shipped with the app | None needed |

## Endpoints used by the server

- `GET /api/nasa/snapshot` — the whole day's briefing (space weather, featured flare, RadLab summary, provenance).
- `GET /api/nasa/space-weather` — unchanged URL and old fields, plus optional `recordedOn` / `note`.
- `GET /api/nasa/flares` — new; real DONKI flare records with kid text.
- `GET /api/nasa/radlab` — unchanged URL, plus `observedWindow` and `fetchedAt`; never labelled live.
- `GET /api/nasa/osdr?topic=` — unchanged URL, plus `fetchedAt`.

`X-Cache` is one of `hit`, `miss`, `stale`, `recorded`, `fallback`.

## Official challenge resources

The challenge page's "Resources" tab was **not pasted into the brief**, so no
item from that list could be used or cited. The one new dataset that the brief
itself names as P1 — NASA DONKI `FLR` solar flares — was added instead. This is
recorded in [decisions.md](decisions.md); when the official list is available it
belongs in this section.

## Attribution

Data from NASA's Open APIs, DONKI and the Open Science Data Repository. This
game is not endorsed by NASA. No NASA or CSA logos or imagery are used.

- NASA Open APIs: <https://api.nasa.gov/>
- DONKI (CCMC): <https://ccmc.gsfc.nasa.gov/tools/DONKI/>
- OSDR: <https://osdr.nasa.gov/bio/>
- OSDR RadLab: <https://visualization.osdr.nasa.gov/>
