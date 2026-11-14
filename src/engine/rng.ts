/**
 * Seeded Pseudo-Random Number Generator (Mulberry32)
 * Ensures "Same Scenario" retries replay identically and tests remain deterministic.
 */

export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateRunId(seed: number): string {
  const rand = Math.floor(createRng(seed ^ Date.now())() * 0xffffff)
    .toString(16)
    .padStart(6, '0');
  return `run_${seed}_${rand}`;
}
