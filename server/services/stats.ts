import type { DifficultyMode } from '../../src/types';
import type { CompletedRunRow, Store } from '../db/store';

export const MIN_SAMPLE = 5;
export const STATS_TTL_MS = 60_000;

export interface DifficultyOutcome {
  runs: number;
  won: number;
  partial: number;
  lost: number;
}

export interface ChoicePopularity {
  round: number;
  choiceId: string;
  count: number;
  share: number;
}

export interface StatsResponse {
  generatedAt: string;
  minSample: number;
  suppressed: boolean;
  totals: {
    runs: number;
    completed: number;
  };
  outcomes: {
    won: number;
    partial: number;
    lost: number;
  };
  failureReasons: {
    oxygen: number;
    health: number;
  };
  averageScore: number;
  byDifficulty: Record<DifficultyMode, DifficultyOutcome>;
  endRound: { round: number; count: number }[];
  choicePopularity: ChoicePopularity[];
}

function emptyByDifficulty(): Record<DifficultyMode, DifficultyOutcome> {
  return {
    cadet: { runs: 0, won: 0, partial: 0, lost: 0 },
    standard: { runs: 0, won: 0, partial: 0, lost: 0 },
    commander: { runs: 0, won: 0, partial: 0, lost: 0 },
  };
}

function suppressedStats(generatedAt: string): StatsResponse {
  return {
    generatedAt,
    minSample: MIN_SAMPLE,
    suppressed: true,
    totals: { runs: 0, completed: 0 },
    outcomes: { won: 0, partial: 0, lost: 0 },
    failureReasons: { oxygen: 0, health: 0 },
    averageScore: 0,
    byDifficulty: emptyByDifficulty(),
    endRound: [],
    choicePopularity: [],
  };
}

/**
 * Counts verified runs only. When fewer than MIN_SAMPLE missions are complete,
 * all numbers are zeroed so a single child's run can never be identified.
 * `share` is the fraction of completed verified runs that picked that choice in
 * that round; the rationale is recorded in docs/backend/decisions.md.
 */
export function computeStats(
  totalVerifiedRuns: number,
  completed: CompletedRunRow[],
  generatedAt: string
): StatsResponse {
  if (completed.length < MIN_SAMPLE) {
    return suppressedStats(generatedAt);
  }

  const byDifficulty = emptyByDifficulty();
  const outcomes = { won: 0, partial: 0, lost: 0 };
  const failureReasons = { oxygen: 0, health: 0 };
  const endRoundCounts = new Map<number, number>();
  const choiceCounts = new Map<string, { round: number; choiceId: string; count: number }>();
  let scoreTotal = 0;

  for (const run of completed) {
    outcomes[run.status] += 1;
    if (run.failureReason) failureReasons[run.failureReason] += 1;

    const difficulty = byDifficulty[run.difficulty];
    difficulty.runs += 1;
    difficulty[run.status] += 1;

    scoreTotal += run.score;
    endRoundCounts.set(run.roundsSurvived, (endRoundCounts.get(run.roundsSurvived) ?? 0) + 1);

    for (const choice of run.choices) {
      const key = `${choice.round}:${choice.choiceId}`;
      const entry = choiceCounts.get(key);
      if (entry) {
        entry.count += 1;
      } else {
        choiceCounts.set(key, { round: choice.round, choiceId: choice.choiceId, count: 1 });
      }
    }
  }

  const endRound = [...endRoundCounts.entries()]
    .map(([round, count]) => ({ round, count }))
    .sort((a, b) => a.round - b.round);

  const choicePopularity = [...choiceCounts.values()]
    .map(entry => ({
      ...entry,
      share: Number((entry.count / completed.length).toFixed(4)),
    }))
    .sort(
      (a, b) =>
        a.round - b.round || b.count - a.count || a.choiceId.localeCompare(b.choiceId)
    );

  return {
    generatedAt,
    minSample: MIN_SAMPLE,
    suppressed: false,
    totals: {
      runs: totalVerifiedRuns,
      completed: completed.length,
    },
    outcomes,
    failureReasons,
    averageScore: Number((scoreTotal / completed.length).toFixed(2)),
    byDifficulty,
    endRound,
    choicePopularity,
  };
}

export class StatsService {
  private cached: StatsResponse | null = null;
  private cachedAt = 0;

  constructor(
    private readonly store: Store,
    private readonly now: () => number,
    private readonly ttlMs: number = STATS_TTL_MS
  ) {}

  async get(): Promise<StatsResponse> {
    const timestamp = this.now();
    if (this.cached && timestamp - this.cachedAt < this.ttlMs) {
      return this.cached;
    }

    const [totalVerifiedRuns, completed] = await Promise.all([
      this.store.countVerifiedRuns(),
      this.store.listCompletedVerifiedRuns(),
    ]);

    const response = computeStats(
      totalVerifiedRuns,
      completed,
      new Date(timestamp).toISOString()
    );
    this.cached = response;
    this.cachedAt = timestamp;
    return response;
  }

  invalidate(): void {
    this.cached = null;
    this.cachedAt = 0;
  }
}
