import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryStore } from '../db/memoryStore';
import { createSqliteStore, type SqliteStore } from '../db/sqliteStore';
import type { StoredRun } from '../db/store';

function sampleRun(overrides: Partial<StoredRun> = {}): StoredRun {
  return {
    runId: 'run_sample_1',
    seed: 1,
    difficulty: 'standard',
    liveFlareBonus: 0,
    status: 'playing',
    failureReason: null,
    roundsSurvived: 2,
    score: null,
    finalPower: null,
    finalOxygen: null,
    finalHealth: null,
    finalMoonDirt: null,
    finalShield: null,
    verified: true,
    mismatch: [],
    report: null,
    startedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:02:00.000Z',
    completedAt: null,
    choices: [
      { round: 1, choiceId: 'dirt_air' },
      { round: 2, choiceId: 'heat_on' },
    ],
    ...overrides,
  };
}

describe('store contract', () => {
  let directory: string;
  let store: SqliteStore;

  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), 'silica-store-'));
    store = createSqliteStore({ dataDir: directory });
  });

  afterEach(async () => {
    await store.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('round-trips a run and its choices', async () => {
    const run = sampleRun();
    await store.saveRun(run);

    const loaded = await store.getRun(run.runId);
    expect(loaded).not.toBeNull();
    expect(loaded).toMatchObject({
      runId: run.runId,
      seed: 1,
      difficulty: 'standard',
      liveFlareBonus: 0,
      status: 'playing',
      verified: true,
      mismatch: [],
      report: null,
      choices: [
        { round: 1, choiceId: 'dirt_air' },
        { round: 2, choiceId: 'heat_on' },
      ],
    });
    expect(await store.getRun('run_missing')).toBeNull();
  });

  it('upserts a run and replaces its choices transactionally', async () => {
    await store.saveRun(sampleRun());
    await store.saveRun(
      sampleRun({
        status: 'lost',
        failureReason: 'oxygen',
        roundsSurvived: 9,
        score: 0,
        finalPower: 4,
        finalOxygen: 0,
        finalHealth: 12,
        finalMoonDirt: 30,
        finalShield: 15,
        updatedAt: '2026-01-01T00:05:00.000Z',
        completedAt: '2026-01-01T00:05:00.000Z',
        choices: [
          { round: 1, choiceId: 'dirt_air' },
          { round: 2, choiceId: 'heat_on' },
          { round: 3, choiceId: 'dirt_shield' },
        ],
      })
    );

    const loaded = await store.getRun('run_sample_1');
    expect(loaded?.status).toBe('lost');
    expect(loaded?.failureReason).toBe('oxygen');
    expect(loaded?.choices.map(choice => choice.round)).toEqual([1, 2, 3]);
  });

  it('counts only verified runs and lists completed verified runs', async () => {
    await store.saveRun(sampleRun({ runId: 'run_playing', status: 'playing', verified: true }));
    await store.saveRun(
      sampleRun({
        runId: 'run_won',
        status: 'won',
        roundsSurvived: 12,
        score: 91,
        verified: true,
        completedAt: '2026-01-02T00:00:00.000Z',
      })
    );
    await store.saveRun(
      sampleRun({
        runId: 'run_forged',
        status: 'won',
        roundsSurvived: 12,
        score: 100,
        verified: false,
        mismatch: ['status'],
        completedAt: '2026-01-02T00:00:00.000Z',
      })
    );

    expect(await store.countVerifiedRuns()).toBe(2);
    const completed = await store.listCompletedVerifiedRuns();
    expect(completed).toHaveLength(1);
    expect(completed[0]).toMatchObject({
      status: 'won',
      roundsSurvived: 12,
      score: 91,
    });

    const finished = await store.listFinishedRuns();
    expect(finished.map(run => run.runId).sort()).toEqual(['run_forged', 'run_won']);
  });

  it('deletes old runs and cascades their choices', async () => {
    await store.saveRun(
      sampleRun({
        runId: 'run_old',
        status: 'won',
        completedAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      })
    );
    await store.saveRun(
      sampleRun({
        runId: 'run_new',
        status: 'won',
        completedAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      })
    );

    const removed = await store.deleteRunsOlderThan('2026-01-01T00:00:00.000Z');
    expect(removed).toBe(1);
    expect(await store.getRun('run_old')).toBeNull();
    expect(await store.getRun('run_new')).not.toBeNull();

    await store.close();
    const raw = new Database(path.join(directory, 'silica.db'));
    const orphan = raw
      .prepare('SELECT COUNT(*) AS count FROM run_choices WHERE run_id = ?')
      .get('run_old') as { count: number };
    expect(orphan.count).toBe(0);
    raw.close();
  });

  it('reports health and reports failure after close', async () => {
    expect(await store.checkHealth()).toBe(true);
    await store.close();
    expect(await store.checkHealth()).toBe(false);
    // afterEach closes again; make it harmless.
    store = createSqliteStore({ dataDir: directory });
  });
});

describe('memory store', () => {
  it('mirrors the SQLite semantics', async () => {
    const store = new MemoryStore();
    await store.saveRun(sampleRun());
    expect(await store.getRun('run_sample_1')).not.toBeNull();
    expect(await store.countVerifiedRuns()).toBe(1);

    await store.saveRun(
      sampleRun({
        status: 'partial',
        roundsSurvived: 12,
        score: 60,
        verified: false,
        completedAt: '2026-01-02T00:00:00.000Z',
      })
    );
    expect(await store.countVerifiedRuns()).toBe(0);
    expect(await store.listCompletedVerifiedRuns()).toHaveLength(0);
    expect(await store.listFinishedRuns()).toHaveLength(1);
  });
});
