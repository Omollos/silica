# Engine findings (not fixed)

The engine was audited but deliberately not changed: altering it would silently
break replay for already-deployed clients. The server works around the issues
below.

1. **`submitChoice` silently ignores an unknown choice id** and returns the same
   state. A server that trusted it would accept a garbage choice and store an
   unchanged run. The replay service therefore checks the id against
   `getRoundView` first (`unknown_choice`).

2. **`submitChoice` accepts disabled choices.** `getRoundView` computes
   `disabled` / `disabledReason`, but the engine never enforces it. The server
   rejects disabled choices with `illegal_choice` using the same view the UI uses.

3. **`getRoundView` force-unlocks a choice when all choices are disabled.** The
   chosen index prefers a zero-or-positive immediate power/dirt choice, else the
   last choice. The server must reproduce this exact view (it does, by calling
   `getRoundView`), otherwise a choice the child could legitimately click would
   be rejected as disabled.

4. **`startGame`'s `runId` is non-deterministic** (`Date.now()` inside
   `generateRunId`). Two replays of identical inputs produce different report
   `runId`s. The server overwrites the engine state's `runId` with the validated
   URL id before building the report.

5. **`buildReport` maps `status: 'playing'` to `outcome: 'won'`.** Calling it on
   an unfinished run would produce a misleading report. The server only calls
   `buildReport` once the replayed status is not `playing`.

6. **`roundsSurvived` for a lost run is `state.round`**, which is the round where
   the crew was lost (the engine does not advance the round on failure). This is
   consistent with the stored choice trace, but it means `roundsSurvived` is not
   always the number of completed rounds. The server stores it as-is so reports
   match the browser.

7. **Stored runs are only replayable with the exact engine version that produced
   them.** The server stores the full server-built report alongside the choices,
   so historical reports survive an engine change even though a future replay
   could disagree. The frontend only replays runs it just played.

8. **`scenario.json` is imported directly by `src/engine/events.ts`.** Development
   (`tsx`) handles the JSON import; the production bundle inlines it. Any future
   server tooling must preserve that JSON import support.

No arithmetic, ordering or balance bug was found in `rules.ts`, `queue.ts`,
`report.ts`, `rng.ts` or `index.ts` during this audit. The existing engine test
suite (10 tests) passes unchanged.
