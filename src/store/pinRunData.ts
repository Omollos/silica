import type { NasaSnapshot } from '../types';

/**
 * Pins a run to the NASA data it started with.
 *
 * Pure helpers only: no React, no zustand, no clock and no network, so the
 * pipeline rule ("two players on the same day get the same mission" and "Same
 * Scenario is identical") can be unit tested directly.
 */

export const SNAPSHOT_WAIT_MS = 2000;
export const NO_SNAPSHOT_ID = 'none';

export type FlareBonus = 0 | 5 | 10;

export interface RunPin {
  snapshotId: string;
  bonus: FlareBonus;
}

export const UNPINNED: RunPin = { snapshotId: NO_SNAPSHOT_ID, bonus: 0 };

export function normalizeBonus(value: unknown): FlareBonus {
  return value === 10 ? 10 : value === 5 ? 5 : 0;
}

/** A pin can only come from a snapshot that actually carried data. */
export function pinFromSnapshot(snapshot: NasaSnapshot | null): RunPin {
  if (!snapshot || snapshot.source === 'unavailable') return { ...UNPINNED };
  const snapshotId =
    typeof snapshot.snapshotId === 'string' && snapshot.snapshotId.length > 0
      ? snapshot.snapshotId
      : NO_SNAPSHOT_ID;
  if (snapshotId === NO_SNAPSHOT_ID) return { ...UNPINNED };
  return { snapshotId, bonus: normalizeBonus(snapshot.bonus) };
}

/**
 * Starting the mission: use the snapshot only if it arrived inside the short
 * budget. Otherwise play unpinned (bonus 0, id "none") instead of blocking.
 */
export function pinForStart(snapshot: NasaSnapshot | null, arrivedInTime: boolean): RunPin {
  return arrivedInTime ? pinFromSnapshot(snapshot) : { ...UNPINNED };
}

/**
 * "Same Scenario" must replay the identical mission, so it reuses the stored
 * pin and never looks at the store's current snapshot again.
 */
export function pinForRetrySame(pinned: RunPin | null | undefined): RunPin {
  if (!pinned || !pinned.snapshotId || pinned.snapshotId === NO_SNAPSHOT_ID) {
    return { ...UNPINNED };
  }
  return { snapshotId: pinned.snapshotId, bonus: normalizeBonus(pinned.bonus) };
}

/** "New Scenario" changes the seed; the pin still comes from today's snapshot. */
export function seedForNewScenario(currentSeed: number): number {
  return currentSeed === 1 ? 42 : currentSeed + 17;
}

export interface WaitTimers {
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

const DEFAULT_TIMERS: WaitTimers = {
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Resolves true if `ready` settles inside the budget, false otherwise. It never
 * rejects and never waits longer than `timeoutMs`.
 */
export function waitForSnapshot(
  ready: Promise<unknown>,
  timeoutMs: number = SNAPSHOT_WAIT_MS,
  timers: WaitTimers = DEFAULT_TIMERS
): Promise<boolean> {
  return new Promise(resolve => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const handle = timers.setTimeout(() => finish(false), Math.max(0, timeoutMs));
    ready.then(
      () => {
        if (!settled) timers.clearTimeout(handle);
        finish(true);
      },
      () => {
        if (!settled) timers.clearTimeout(handle);
        finish(false);
      }
    );
  });
}
