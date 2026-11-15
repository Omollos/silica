import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { MissionReport } from '../../src/types';
import { runMigrations } from './migrate';
import type { CompletedRunRow, RunChoiceRecord, StoredRun, Store } from './store';

interface RunRow {
  run_id: string;
  seed: number;
  difficulty: string;
  live_flare_bonus: number;
  status: string;
  failure_reason: string | null;
  rounds_survived: number;
  score: number | null;
  final_power: number | null;
  final_oxygen: number | null;
  final_health: number | null;
  final_moon_dirt: number | null;
  final_shield: number | null;
  verified: number;
  mismatch: string | null;
  report_json: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface ChoiceRow {
  round: number;
  choice_id: string;
}

export interface SqliteStoreOptions {
  dataDir: string;
  /** Override for tests; defaults to <dataDir>/silica.db. */
  filePath?: string;
}

function parseReport(raw: string | null): MissionReport | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MissionReport;
  } catch {
    return null;
  }
}

export class SqliteStore implements Store {
  private readonly db: Database.Database;

  constructor(options: SqliteStoreOptions) {
    const filePath =
      options.filePath ?? path.join(options.dataDir, 'silica.db');

    if (filePath !== ':memory:') {
      mkdirSync(path.dirname(filePath), { recursive: true });
    }

    this.db = new Database(filePath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    runMigrations(this.db);
  }

  async init(): Promise<void> {
    // The constructor already opened the file and applied idempotent migrations.
  }

  async checkHealth(): Promise<boolean> {
    try {
      this.db.prepare('SELECT 1 AS ok').get();
      return true;
    } catch {
      return false;
    }
  }

  private choicesFor(runId: string): RunChoiceRecord[] {
    const rows = this.db
      .prepare('SELECT round, choice_id FROM run_choices WHERE run_id = ? ORDER BY round ASC')
      .all(runId) as ChoiceRow[];
    return rows.map(row => ({ round: row.round, choiceId: row.choice_id }));
  }

  private rowToRun(row: RunRow): StoredRun {
    return {
      runId: row.run_id,
      seed: row.seed,
      difficulty: row.difficulty as StoredRun['difficulty'],
      liveFlareBonus: row.live_flare_bonus,
      status: row.status as StoredRun['status'],
      failureReason: row.failure_reason as StoredRun['failureReason'],
      roundsSurvived: row.rounds_survived,
      score: row.score,
      finalPower: row.final_power,
      finalOxygen: row.final_oxygen,
      finalHealth: row.final_health,
      finalMoonDirt: row.final_moon_dirt,
      finalShield: row.final_shield,
      verified: row.verified === 1,
      mismatch: row.mismatch ? row.mismatch.split(',').filter(Boolean) : [],
      report: parseReport(row.report_json),
      startedAt: row.started_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      choices: this.choicesFor(row.run_id),
    };
  }

  async getRun(runId: string): Promise<StoredRun | null> {
    const row = this.db
      .prepare('SELECT * FROM runs WHERE run_id = ?')
      .get(runId) as RunRow | undefined;
    return row ? this.rowToRun(row) : null;
  }

  async saveRun(run: StoredRun): Promise<void> {
    const upsertRun = this.db.prepare(`
      INSERT INTO runs (
        run_id, seed, difficulty, live_flare_bonus, status, failure_reason,
        rounds_survived, score, final_power, final_oxygen, final_health,
        final_moon_dirt, final_shield, verified, mismatch, report_json,
        started_at, updated_at, completed_at
      ) VALUES (
        @run_id, @seed, @difficulty, @live_flare_bonus, @status, @failure_reason,
        @rounds_survived, @score, @final_power, @final_oxygen, @final_health,
        @final_moon_dirt, @final_shield, @verified, @mismatch, @report_json,
        @started_at, @updated_at, @completed_at
      )
      ON CONFLICT(run_id) DO UPDATE SET
        seed = excluded.seed,
        difficulty = excluded.difficulty,
        live_flare_bonus = excluded.live_flare_bonus,
        status = excluded.status,
        failure_reason = excluded.failure_reason,
        rounds_survived = excluded.rounds_survived,
        score = excluded.score,
        final_power = excluded.final_power,
        final_oxygen = excluded.final_oxygen,
        final_health = excluded.final_health,
        final_moon_dirt = excluded.final_moon_dirt,
        final_shield = excluded.final_shield,
        verified = excluded.verified,
        mismatch = excluded.mismatch,
        report_json = excluded.report_json,
        updated_at = excluded.updated_at,
        completed_at = excluded.completed_at
    `);

    const deleteChoices = this.db.prepare('DELETE FROM run_choices WHERE run_id = ?');
    const insertChoice = this.db.prepare(
      'INSERT INTO run_choices (run_id, round, choice_id) VALUES (?, ?, ?)'
    );

    const write = this.db.transaction((record: StoredRun) => {
      upsertRun.run({
        run_id: record.runId,
        seed: record.seed,
        difficulty: record.difficulty,
        live_flare_bonus: record.liveFlareBonus,
        status: record.status,
        failure_reason: record.failureReason,
        rounds_survived: record.roundsSurvived,
        score: record.score,
        final_power: record.finalPower,
        final_oxygen: record.finalOxygen,
        final_health: record.finalHealth,
        final_moon_dirt: record.finalMoonDirt,
        final_shield: record.finalShield,
        verified: record.verified ? 1 : 0,
        mismatch: record.mismatch.length > 0 ? record.mismatch.join(',') : null,
        report_json: record.report ? JSON.stringify(record.report) : null,
        started_at: record.startedAt,
        updated_at: record.updatedAt,
        completed_at: record.completedAt,
      });
      deleteChoices.run(record.runId);
      for (const choice of [...record.choices].sort((a, b) => a.round - b.round)) {
        insertChoice.run(record.runId, choice.round, choice.choiceId);
      }
    });

    write(run);
  }

  async countVerifiedRuns(): Promise<number> {
    const row = this.db
      .prepare('SELECT COUNT(*) AS count FROM runs WHERE verified = 1')
      .get() as { count: number };
    return row.count;
  }

  async listCompletedVerifiedRuns(): Promise<CompletedRunRow[]> {
    const rows = this.db
      .prepare(
        "SELECT * FROM runs WHERE verified = 1 AND status IN ('won', 'partial', 'lost') ORDER BY completed_at ASC"
      )
      .all() as RunRow[];

    return rows.map(row => ({
      difficulty: row.difficulty as CompletedRunRow['difficulty'],
      status: row.status as CompletedRunRow['status'],
      failureReason: row.failure_reason as CompletedRunRow['failureReason'],
      roundsSurvived: row.rounds_survived,
      score: row.score ?? 0,
      choices: this.choicesFor(row.run_id),
    }));
  }

  async listFinishedRuns(): Promise<StoredRun[]> {
    const rows = this.db
      .prepare(
        "SELECT * FROM runs WHERE status IN ('won', 'partial', 'lost') ORDER BY completed_at ASC"
      )
      .all() as RunRow[];
    return rows.map(row => this.rowToRun(row));
  }

  async deleteRunsOlderThan(isoDate: string): Promise<number> {
    const result = this.db
      .prepare(
        'DELETE FROM runs WHERE COALESCE(completed_at, updated_at) < ?'
      )
      .run(isoDate);
    return result.changes;
  }

  async close(): Promise<void> {
    if (this.db.open) this.db.close();
  }
}

export function createSqliteStore(options: SqliteStoreOptions): SqliteStore {
  return new SqliteStore(options);
}