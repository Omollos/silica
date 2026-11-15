import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRunPayload, flushPendingRuns, syncRun } from '../../src/api/runsClient';
import { getRoundView, startGame, submitChoice } from '../../src/engine';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  };
}

function pending(): { runId: string }[] {
  const raw = localStorage.getItem('silica.pendingRuns');
  return raw ? (JSON.parse(raw) as { runId: string }[]) : [];
}

function playableState() {
  let state = { ...startGame(1, 'standard', 5), runId: 'run_client_sync_1' };
  state = submitChoice(state, 'dirt_air');
  state = submitChoice(state, 'heat_on');
  return state;
}

describe('frontend run client', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('builds the exact API body from GameState', () => {
    const state = playableState();
    const payload = buildRunPayload(state);

    expect(payload).toEqual({
      seed: 1,
      difficulty: 'standard',
      liveFlareBonus: 5,
      choices: [
        { round: 1, choiceId: 'dirt_air' },
        { round: 2, choiceId: 'heat_on' },
      ],
      clientSummary: {
        status: 'playing',
        round: 3,
        power: state.power,
        oxygen: state.oxygen,
        health: state.health,
      },
    });
  });

  it('defaults a missing live flare bonus to zero', () => {
    const state = { ...startGame(1, 'standard'), runId: 'run_client_sync_0' };
    expect(buildRunPayload(state).liveFlareBonus).toBe(0);
  });

  it('adds the pinned snapshot id next to the flare bonus, and omits it when unpinned', () => {
    const state = playableState();
    expect(buildRunPayload(state, '2026-11-15').nasaSnapshotId).toBe('2026-11-15');
    expect(buildRunPayload(state, 'none').nasaSnapshotId).toBeUndefined();
    expect(buildRunPayload(state).nasaSnapshotId).toBeUndefined();
  });

  it('sends a successful sync and leaves nothing queued', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await syncRun(playableState());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/runs/run_client_sync_1');
    expect(pending()).toEqual([]);
  });

  it('never queues a 4xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 400 })));

    await syncRun(playableState());

    expect(pending()).toEqual([]);
  });

  it('queues network failures and 5xx responses, then flushes after reconnecting', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await syncRun(playableState());

    expect(pending()).toHaveLength(1);
    expect(pending()[0].runId).toBe('run_client_sync_1');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));
    await flushPendingRuns();
    expect(pending()).toHaveLength(1);

    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await flushPendingRuns();

    expect(pending()).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/runs/run_client_sync_1');
  });

  it('keeps at most 20 queued runs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    for (let index = 0; index < 25; index += 1) {
      const state = { ...startGame(1, 'standard'), runId: `run_client_pending_${index}` };
      await syncRun(state);
    }

    expect(pending()).toHaveLength(20);
    expect(pending()[19].runId).toBe('run_client_pending_24');
  });

  it('does not throw when the backend is missing entirely', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    await expect(syncRun(playableState())).resolves.toBeUndefined();
  });

  it('plays identically when /api/runs is blocked', () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('blocked')));

    let state = startGame(1, 'standard');
    while (state.status === 'playing') {
      const view = getRoundView(state);
      const choice = view.choices.find(candidate => !candidate.disabled);
      if (!choice) throw new Error('deadlock');
      state = submitChoice(state, choice.id);
    }

    expect(['won', 'partial', 'lost']).toContain(state.status);
  });
});
