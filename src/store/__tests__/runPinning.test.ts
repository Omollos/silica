import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NasaSnapshot } from '../../types';
import { useGameStore } from '../gameStore';
import { useNasaDataStore } from '../nasaDataStore';

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

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(() => {
  useGameStore.setState({
    screen: 'title',
    currentSeed: 1,
    difficulty: 'standard',
    pinnedSnapshotId: 'none',
    pinnedBonus: 0,
    startingMission: false,
    outcomeModalOpen: false,
  });
  useNasaDataStore.setState({
    snapshot: null,
    snapshotLoading: false,
    snapshotError: null,
    useLiveWeather: true,
  });
});

describe('game store pinning', () => {
  it('starts with the snapshot bonus and records the pin', async () => {
    useNasaDataStore.setState({ snapshot: snapshot({ bonus: 10 }) });

    await useGameStore.getState().beginMission(1, 'standard', { waitMs: 50 });

    const state = useGameStore.getState();
    expect(state.screen).toBe('playing');
    expect(state.gameState.liveFlareBonus).toBe(10);
    expect(state.pinnedBonus).toBe(10);
    expect(state.pinnedSnapshotId).toBe('2026-11-15');
  });

  it('Same Scenario keeps the pinned bonus even when the store snapshot changes', async () => {
    useGameStore.setState({
      currentSeed: 7,
      pinnedSnapshotId: '2026-11-15',
      pinnedBonus: 5,
    });
    // A new day / new data has arrived in the store: it must not be used.
    useNasaDataStore.setState({ snapshot: snapshot({ snapshotId: '2026-11-16', bonus: 0 }) });

    useGameStore.getState().retrySameScenario();
    await tick();

    const state = useGameStore.getState();
    expect(state.gameState.seed).toBe(7);
    expect(state.gameState.liveFlareBonus).toBe(5);
    expect(state.pinnedSnapshotId).toBe('2026-11-15');
    expect(state.pinnedBonus).toBe(5);
  });

  it('Same Scenario of an unpinned run stays unpinned', async () => {
    useGameStore.setState({ currentSeed: 3, pinnedSnapshotId: 'none', pinnedBonus: 0 });
    useNasaDataStore.setState({ snapshot: snapshot({ bonus: 10 }) });

    useGameStore.getState().retrySameScenario();
    await tick();

    const state = useGameStore.getState();
    expect(state.gameState.liveFlareBonus).toBe(0);
    expect(state.pinnedSnapshotId).toBe('none');
  });

  it('New Scenario changes the seed and uses the current snapshot', async () => {
    useGameStore.setState({ currentSeed: 7, pinnedSnapshotId: '2026-11-15', pinnedBonus: 5 });
    useNasaDataStore.setState({ snapshot: snapshot({ snapshotId: '2026-11-16', bonus: 0 }) });

    useGameStore.getState().retryNewScenario();
    await tick();

    const state = useGameStore.getState();
    expect(state.gameState.seed).toBe(24);
    expect(state.pinnedSnapshotId).toBe('2026-11-16');
    expect(state.gameState.liveFlareBonus).toBe(0);
  });

  it('falls back to bonus 0 / id none when the snapshot never arrives', async () => {
    const never = vi.fn(() => new Promise<void>(() => undefined));
    useNasaDataStore.setState({ snapshot: null, fetchSnapshot: never });

    const startedAt = Date.now();
    await useGameStore.getState().beginMission(1, 'standard', { waitMs: 30 });
    const elapsed = Date.now() - startedAt;

    const state = useGameStore.getState();
    expect(elapsed).toBeLessThan(1000);
    expect(elapsed).toBeGreaterThanOrEqual(25);
    expect(state.screen).toBe('playing');
    expect(state.gameState.liveFlareBonus).toBe(0);
    expect(state.pinnedSnapshotId).toBe('none');
    expect(never).toHaveBeenCalled();
  });

  it('respects the opt-out of live weather', async () => {
    useNasaDataStore.setState({ snapshot: snapshot({ bonus: 10 }), useLiveWeather: false });

    await useGameStore.getState().beginMission(1, 'standard', { waitMs: 50 });

    const state = useGameStore.getState();
    expect(state.gameState.liveFlareBonus).toBe(0);
    expect(state.pinnedSnapshotId).toBe('none');
  });
});
