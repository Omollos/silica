import { describe, expect, it } from 'vitest';
import type { NasaSnapshot } from '../../types';
import {
  NO_SNAPSHOT_ID,
  SNAPSHOT_WAIT_MS,
  normalizeBonus,
  pinForRetrySame,
  pinForStart,
  pinFromSnapshot,
  seedForNewScenario,
  waitForSnapshot,
} from '../pinRunData';

function snapshot(overrides: Partial<NasaSnapshot> = {}): NasaSnapshot {
  return {
    snapshotId: '2026-11-15',
    generatedAt: '2026-11-15T00:02:11.000Z',
    source: 'live',
    bonus: 5,
    spaceWeather: null,
    flare: null,
    radiation: null,
    provenance: [],
    ...overrides,
  };
}

describe('pinning NASA data to a run', () => {
  it('pins the snapshot id and the bonus', () => {
    expect(pinFromSnapshot(snapshot())).toEqual({ snapshotId: '2026-11-15', bonus: 5 });
    expect(pinFromSnapshot(snapshot({ bonus: 10 }))).toEqual({
      snapshotId: '2026-11-15',
      bonus: 10,
    });
  });

  it('never pins data from an unavailable snapshot', () => {
    expect(pinFromSnapshot(null)).toEqual({ snapshotId: NO_SNAPSHOT_ID, bonus: 0 });
    expect(pinFromSnapshot(snapshot({ source: 'unavailable', bonus: 10 }))).toEqual({
      snapshotId: NO_SNAPSHOT_ID,
      bonus: 0,
    });
  });

  it('plays unpinned when the snapshot did not arrive in time', () => {
    expect(pinForStart(snapshot(), false)).toEqual({ snapshotId: NO_SNAPSHOT_ID, bonus: 0 });
    expect(pinForStart(snapshot(), true)).toEqual({ snapshotId: '2026-11-15', bonus: 5 });
    expect(pinForStart(null, true)).toEqual({ snapshotId: NO_SNAPSHOT_ID, bonus: 0 });
  });

  it('reuses the pinned values for Same Scenario', () => {
    const pin = { snapshotId: '2026-11-15', bonus: 10 } as const;
    expect(pinForRetrySame(pin)).toEqual(pin);
    expect(pinForRetrySame(null)).toEqual({ snapshotId: NO_SNAPSHOT_ID, bonus: 0 });
    expect(pinForRetrySame({ snapshotId: NO_SNAPSHOT_ID, bonus: 10 })).toEqual({
      snapshotId: NO_SNAPSHOT_ID,
      bonus: 0,
    });
  });

  it('changes the seed for New Scenario without touching the pin helper', () => {
    expect(seedForNewScenario(1)).toBe(42);
    expect(seedForNewScenario(42)).toBe(59);
    expect(seedForNewScenario(7)).toBe(24);
  });

  it('only accepts the three real bonus values', () => {
    expect(normalizeBonus(10)).toBe(10);
    expect(normalizeBonus(5)).toBe(5);
    expect(normalizeBonus(0)).toBe(0);
    expect(normalizeBonus(7)).toBe(0);
    expect(normalizeBonus(undefined)).toBe(0);
  });

  it('waits at most two seconds for the snapshot', async () => {
    let usedMs = -1;
    const timers = {
      setTimeout: (callback: () => void, ms: number) => {
        usedMs = ms;
        setTimeout(callback, 0);
        return 0;
      },
      clearTimeout: () => undefined,
    };

    const result = await waitForSnapshot(new Promise<never>(() => undefined), undefined, timers);
    expect(result).toBe(false);
    expect(usedMs).toBe(SNAPSHOT_WAIT_MS);
    expect(SNAPSHOT_WAIT_MS).toBe(2000);
  });

  it('resolves true as soon as the snapshot arrives', async () => {
    await expect(waitForSnapshot(Promise.resolve('snapshot'), 50)).resolves.toBe(true);
    await expect(waitForSnapshot(Promise.reject(new Error('offline')), 50)).resolves.toBe(false);
  });
});
