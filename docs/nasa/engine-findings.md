# Engine findings (reported, not fixed)

The engine (`src/engine/`) and `src/content/scenario.json` were not modified:
changing either would silently break replay for stored runs. These observations
are recorded for whoever owns the engine.

1. **The round 8 flare message in the engine says "Live NASA".**
   `submitChoice` appends `" Live NASA DONKI solar activity added +N storm
   strength."` to the flare result text (`src/engine/index.ts`). That text is
   rendered to the child by `ResultLine` through `scheduledEventMessage`. A run
   pinned to a recorded snapshot (or a run from earlier in the UTC day) is not
   live, so the word "Live" can be inaccurate. The NASA work could not change it
   without touching the engine, which the brief forbids. Suggested fix: replace
   that clause with a neutral sentence and let the UI add the truth label.

2. **`liveFlareBonus` is accepted unbounded.** `startGame(seed, difficulty,
   liveFlareBonus)` stores whatever number it is given and `computeFlareDamage`
   adds it without clamping. The client only ever sends the pinned 0 / 5 / 10
   and the run API validates the same three values, but a direct caller could
   pass e.g. `1000`. Not exploitable through the shipped UI; a clamp in
   `startGame` would make the invariant explicit.

3. **The bonus is added before the shield is subtracted**, so a full 30/30 shield
   absorbs the whole +10 bonus (25 vs 15 damage) rather than the storm mattering
   after shielding. This is the existing, documented balance and was deliberately
   left unchanged.

4. **`getRoundView` force-unlocks one choice when every choice is disabled**
   (already documented in `docs/backend/engine-findings.md`). Unrelated to NASA,
   but it means the round 8 flare is always reachable.

No arithmetic or ordering bug was found in `computeFlareDamage`,
`applyResourceDelta`, `applyUpkeep` or the scheduled-event branch. The existing
engine test suite passes unchanged.
