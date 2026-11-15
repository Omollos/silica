# How NASA data affects gameplay (judges' one-pager)

## The question

> "Where does the NASA data come from, and does it really change the game?"

## The daily snapshot

Every UTC day the server builds one snapshot (`/api/nasa/snapshot`):

1. four DONKI calls (CME, GST, SEP, FLR) for the last 28 days;
2. one RadLab call for its fixed, real ISS recording window;
3. `bonus` and `activityLevel` derived from the parsed numbers.

That object is stored in memory and, when the disk is writable, in
`data/nasa/snapshot-YYYY-MM-DD.json`. Every request for the rest of the UTC day
returns the identical object, so two children in the same classroom get the same
mission, and a retry in the same day can never silently change difficulty.

The client fetches the snapshot once, and the game store **pins** it to the run:
`pinnedSnapshotId` plus `pinnedBonus`. "Try Again · Same Scenario" reuses those
two values without asking the network again; "Try Again · New Scenario" changes
the seed and uses the same day's snapshot.

## The thresholds (unchanged from the original build)

| Condition (last 28 days) | Activity | Bonus |
| --- | --- | --- |
| any solar particle event, or Kp ≥ 6, or CME ≥ 1000 km/s | Storm Watch | **10** |
| Kp ≥ 5, or CME ≥ 650 km/s, or 12+ CMEs | Elevated | **5** |
| anything else | Quiet | **0** |

Parsed from real DONKI fields only (`sepCount`, `maxKpIndex`, `maxCmeSpeedKmS`,
`cmeCount`). `computeBonus` is a pure function with tests at each boundary.

## The flare formula (from `src/engine/rules.ts`)

```text
effectiveShield = min(30, shield)
rawDamage       = max(0, 45 + liveBonus - effectiveShield)
damage          = sheltered ? ceil(rawDamage / 2) : rawDamage
```

Round 8 is the solar flare. `liveBonus` is exactly the pinned `bonus` (0, 5 or
10). Nothing else about the engine or `scenario.json` was changed.

### Worked example

| Situation | No solar activity (0) | Elevated (5) | Storm Watch (10) |
| --- | --- | --- | --- |
| Full 30/30 roof shield | 45 − 30 = **15** damage | 50 − 30 = **20** | 55 − 30 = **25** |
| Full shield + shelter | ceil(15 / 2) = **8** | ceil(20 / 2) = **10** | ceil(25 / 2) = **13** |
| No shield, no shelter | **45** damage | **50** | **55** |

So a real storm day is materially harsher: at full shield the flare deals 25
instead of 15 health (13 instead of 8 while sheltered). The bonus is added
before the shield is subtracted, so a thick roof can absorb the extra 10.

## What is presentation only

These never change damage, resources or scoring:

- the featured DONKI flare (date, class C/M/X, kid sentence) on rounds 6 and 8
  and in the Mission Report;
- the RadLab ISS recording in the Science Library and the crew's radiation note;
- OSDR study cards and the curated kid summaries;
- the static NASA/CSA facts.

## What children actually see

- only templated sentences from `src/content/nasaKid.json`, filled with a
  validated number, a single class letter or a date;
- no raw NASA free text (CME notes, study titles/descriptions) on a child
  screen; study titles live behind a "For grown-ups" expander;
- every outbound link behind the grown-up gate ("Ask a grown-up: what is 7 + 8?");
- one calm line if NASA is unreachable — never an error code or a red message.

## Prove it yourself

```bash
bun run test             # parsers, thresholds, snapshot, pinning, contract, kid text
bun run verify:nasa      # real network: endpoints, links, snapshot build
bun run check:kid-text   # sentence length and banned words
```

The provenance array returned with every snapshot lists each dataset, its URL,
the data window and the fetch time, so the data behind any mission can be traced
back to the exact upstream call. Attribution: "Data from NASA's Open APIs, DONKI
and the Open Science Data Repository. This game is not endorsed by NASA."
