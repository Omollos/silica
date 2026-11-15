import type { DifficultyMode, MissionReport } from '../../src/types';

export type RunStatus = 'playing' | 'won' | 'partial' | 'lost';
export type FailureReason = 'oxygen' | 'health' | null;

export interface RunChoiceRecord {
  round: number;
  choiceId: string;
}

export interface StoredRun {
  runId: string;
  seed: number;
  difficulty: DifficultyMode;
  liveFlareBonus: number;
  status: RunStatus;
  failureReason: FailureReason;
  roundsSurvived: number;
  score: number | null;
  finalPower: number | null;
  finalOxygen: number | null;
  finalHealth: number | null;
  finalMoonDirt: number | null;
  finalShield: number | null;
  verified: boolean;
  mismatch: string[];
  report: MissionReport | null;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  choices: RunChoiceRecord[];
}

export interface CompletedRunRow {
  difficulty: DifficultyMode;
  status: 'won' | 'partial' | 'lost';
  failureReason: FailureReason;
  roundsSurvived: number;
  score: number;
  choices: RunChoiceRecord[];
}

/**
 * All persistence goes through this interface. The SQLite implementation is the
 * production default; the memory implementation is used by tests. Nothing here
 * accepts an IP address, cookie, user agent or free text.
 */
export interface Store {
  init(): Promise<void>;
  checkHealth(): Promise<boolean>;

  getRun(runId: string): Promise<StoredRun | null>;
  saveRun(run: StoredRun): Promise<void>;

  countVerifiedRuns(): Promise<number>;
  listCompletedVerifiedRuns(): Promise<CompletedRunRow[]>;
  listFinishedRuns(): Promise<StoredRun[]>;

  deleteRunsOlderThan(isoDate: string): Promise<number>;
  close(): Promise<void>;
}