import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { StoredRun } from '../db/store';
import { createTestApp } from './helpers';

function completedRun(overrides: Partial<StoredRun>): StoredRun {
  return {
    runId: `run_stats_${Math.random().toString(36).slice(2, 10)}`,
    seed: 1,
    difficulty: 'standard',
    liveFlareBonus: 0,
    status: 'won',
    failureReason: null,
    roundsSurvived: 12,
    score: 90,
    finalPower: 30,
    finalOxygen: 20,
    finalHealth: 90,
    finalMoonDirt: 10,
    finalShield: 15,
    verified: true,
    mismatch: [],
    report: null,
    startedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:10:00.000Z',
    completedAt: '2026-01-01T00:10:00.000Z',
    choices: [],
    ...overrides,
  };
}

const FIXTURE: StoredRun[] = [
  completedRun({
    runId: 'run_stats_one',
    difficulty: 'cadet',
    status: 'won',
    roundsSurvived: 12,
    score: 90,
    choices: [
      { round: 1, choiceId: 'dirt_air' },
      { round: 2, choiceId: 'heat_on' },
    ],
  }),
  completedRun({
    runId: 'run_stats_two',
    difficulty: 'standard',
    status: 'won',
    roundsSurvived: 12,
    score: 84,
    choices: [
      { round: 1, choiceId: 'dirt_air' },
      { round: 2, choiceId: 'heat_off' },
    ],
  }),
  completedRun({
    runId: 'run_stats_three',
    difficulty: 'standard',
    status: 'lost',
    failureReason: 'oxygen',
    roundsSurvived: 8,
    score: 0,
    choices: [{ round: 1, choiceId: 'dirt_air' }],
  }),
  completedRun({
    runId: 'run_stats_four',
    difficulty: 'commander',
    status: 'lost',
    failureReason: 'health',
    roundsSurvived: 9,
    score: 0,
    choices: [{ round: 1, choiceId: 'dirt_shield' }],
  }),
  completedRun({
    runId: 'run_stats_five',
    difficulty: 'commander',
    status: 'partial',
    roundsSurvived: 12,
    score: 60,
    choices: [
      { round: 1, choiceId: 'dirt_air' },
      { round: 2, choiceId: 'heat_on' },
    ],
  }),
  completedRun({
    runId: 'run_stats_six',
    difficulty: 'cadet',
    status: 'lost',
    failureReason: 'oxygen',
    roundsSurvived: 10,
    score: 0,
    choices: [{ round: 1, choiceId: 'dirt_build' }],
  }),
];

describe('GET /api/stats', () => {
  it('suppresses samples smaller than five completed runs', async () => {
    const { app, store } = createTestApp();
    for (const run of FIXTURE.slice(0, 4)) {
      await store.saveRun(run);
    }

    const response = await request(app).get('/api/stats');

    expect(response.status).toBe(200);
    expect(response.body.suppressed).toBe(true);
    expect(response.body.minSample).toBe(5);
    expect(response.body.totals).toEqual({ runs: 0, completed: 0 });
    expect(response.body.outcomes).toEqual({ won: 0, partial: 0, lost: 0 });
    expect(response.body.failureReasons).toEqual({ oxygen: 0, health: 0 });
    expect(response.body.averageScore).toBe(0);
    expect(response.body.byDifficulty.cadet).toEqual({
      runs: 0,
      won: 0,
      partial: 0,
      lost: 0,
    });
    expect(response.body.endRound).toEqual([]);
    expect(response.body.choicePopularity).toEqual([]);
    expect(response.headers['cache-control']).toBe('public, max-age=60');
  });

  it('computes exact aggregates for the hand-computed fixture and excludes unverified runs', async () => {
    const { app, store } = createTestApp();
    for (const run of FIXTURE) {
      await store.saveRun(run);
    }

    // An unverified completed run must not affect any count.
    await store.saveRun(
      completedRun({
        runId: 'run_stats_forged',
        status: 'won',
        score: 100,
        verified: false,
        mismatch: ['status'],
        choices: [{ round: 1, choiceId: 'dirt_air' }],
      })
    );
    // An in-progress verified run counts toward `runs` but not completed stats.
    await store.saveRun(
      completedRun({
        runId: 'run_stats_playing',
        status: 'playing',
        failureReason: null,
        roundsSurvived: 2,
        score: null,
        completedAt: null,
        choices: [{ round: 1, choiceId: 'dirt_air' }],
      })
    );

    const response = await request(app).get('/api/stats');
    const stats = response.body;

    expect(response.status).toBe(200);
    expect(stats.suppressed).toBe(false);
    expect(stats.minSample).toBe(5);
    expect(stats.totals).toEqual({ runs: 7, completed: 6 });
    expect(stats.outcomes).toEqual({ won: 2, partial: 1, lost: 3 });
    expect(stats.failureReasons).toEqual({ oxygen: 2, health: 1 });
    expect(stats.averageScore).toBe(39);
    expect(stats.byDifficulty).toEqual({
      cadet: { runs: 2, won: 1, partial: 0, lost: 1 },
      standard: { runs: 2, won: 1, partial: 0, lost: 1 },
      commander: { runs: 2, won: 0, partial: 1, lost: 1 },
    });
    expect(stats.endRound).toEqual([
      { round: 8, count: 1 },
      { round: 9, count: 1 },
      { round: 10, count: 1 },
      { round: 12, count: 3 },
    ]);
    expect(stats.choicePopularity).toEqual([
      { round: 1, choiceId: 'dirt_air', count: 4, share: 0.6667 },
      { round: 1, choiceId: 'dirt_build', count: 1, share: 0.1667 },
      { round: 1, choiceId: 'dirt_shield', count: 1, share: 0.1667 },
      { round: 2, choiceId: 'heat_on', count: 2, share: 0.3333 },
      { round: 2, choiceId: 'heat_off', count: 1, share: 0.1667 },
    ]);

    const totalShares = stats.choicePopularity
      .filter((entry: { round: number }) => entry.round === 1)
      .reduce((sum: number, entry: { share: number }) => sum + entry.share, 0);
    // Shares are rounded individually, so the sum is approximately one.
    expect(totalShares).toBeCloseTo(1, 3);
  });

  it('caches results for 60 seconds', async () => {
    const clock = { value: 1_700_000_000_000 };
    const { app, store } = createTestApp({ now: () => clock.value });
    for (const run of FIXTURE) {
      await store.saveRun(run);
    }

    const first = await request(app).get('/api/stats');
    expect(first.body.totals.completed).toBe(6);

    await store.saveRun(
      completedRun({
        runId: 'run_stats_late',
        status: 'won',
        score: 70,
        choices: [{ round: 1, choiceId: 'dirt_air' }],
      })
    );

    const cached = await request(app).get('/api/stats');
    expect(cached.body.totals.completed).toBe(6);

    clock.value += 61_000;
    const refreshed = await request(app).get('/api/stats');
    expect(refreshed.body.totals.completed).toBe(7);
  });
});
