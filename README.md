# Silica Station — Junior Astronaut Mission Trainer

A 12-stage lunar survival game for the NASA Space Apps Challenge 2026. Every
choice has an immediate cost and a consequence that lands three rounds later.

Built with React 19, Vite, Tailwind 4, Zustand 5, Vitest and a small Express
backend.

```bash
bun install
bun run dev
```

## Backend

The server saves anonymous mission runs, replays them with the same game engine
to verify them, exposes anonymous classroom statistics, and proxies live NASA
data (DONKI space weather, ISS RadLab dosimetry, OSDR studies) with clear
`source: "fallback"` labels and `X-Cache` headers. The game works fully without
it.

```bash
bun run dev     # Vite middleware + API on one origin
bun run build   # dist/ + server.js
bun run start   # node server.js
bun run test    # vitest run
```

- [API reference](docs/backend/API.md)
- [Privacy statement](docs/backend/PRIVACY.md)
- [Operations guide](docs/backend/OPERATIONS.md)
- [Backend decisions](docs/backend/decisions.md)
- [Engine findings](docs/backend/engine-findings.md)
- [OpenAPI document](openapi.yaml)

Data is anonymous by design: no accounts, cookies, IP storage, free text or
third-party analytics. Runs are replayed server-side, and unreliable runs are
stored with `verified: false` and excluded from statistics.

## NASA data

NASA data is not decoration: `GET /api/nasa/snapshot` becomes one daily mission
briefing (space weather plus a real DONKI solar flare plus an ISS radiation
recording), and its bonus (0, 5 or 10) is pinned to the run and added to the
round 8 flare damage. Everyone playing on the same UTC day gets the same
mission; "Same Scenario" replays the exact pin. Everything is labelled live,
recorded or offline, and no invented number is ever presented as NASA data.

```bash
bun run record:nasa      # record one real day for offline demos (needs a key)
bun run verify:nasa      # check every endpoint, link and the snapshot (network)
bun run check:kid-text   # sentence length and banned words in kid copy
```

- [Data sources](docs/nasa/DATA_SOURCES.md)
- [How NASA data affects gameplay (judges' one-pager)](docs/nasa/HOW_NASA_DATA_AFFECTS_GAMEPLAY.md)
- [NASA operations guide](docs/nasa/OPERATIONS.md)
- [NASA decisions](docs/nasa/decisions.md)
- [NASA engine findings](docs/nasa/engine-findings.md)

Data from NASA's Open APIs, DONKI and the Open Science Data Repository. This
game is not endorsed by NASA.
