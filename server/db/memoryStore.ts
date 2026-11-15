import type { CompletedRunRow, StoredRun, Store } from './store';

function cloneRun(run: StoredRun): StoredRun {
  return structuredClone(run);
}

/** In-memory Store with the exact same semantics as SqliteStore. */
export class MemoryStore implements Store {
  private readonly runs = new Map<string, StoredRun>();
  private healthy = true;

  async init(): Promise<void> {
    // Nothing to do.
  }

  async checkHealth(): Promise<boolean> {
    return this.healthy;
  }

  /** Test hook for the /api/health failure path. */
  setHealthy(healthy: boolean): void {
    this.healthy = healthy;
  }

  async getRun(runId: string): Promise<StoredRun | null> {
    const run = this.runs.get(runId);
    return run ? cloneRun(run) : null;
  }

  async saveRun(run: StoredRun): Promise<void> {
    this.runs.set(run.runId, cloneRun(run));
  }

  async countVerifiedRuns(): Promise<number> {
    let count = 0;
    for (const run of this.runs.values()) {
      if (run.verified) count += 1;
    }
    return count;
  }

  async listCompletedVerifiedRuns(): Promise<CompletedRunRow[]> {
    const completed: CompletedRunRow[] = [];
    for (const run of this.runs.values()) {
      if (!run.verified || run.status === 'playing') continue;
      completed.push({
        difficulty: run.difficulty,
        status: run.status,
        failureReason: run.failureReason,
        roundsSurvived: run.roundsSurvived,
        score: run.score ?? 0,
        choices: run.choices.map(choice => ({ ...choice })),
      });
    }
    completed.sort((a, b) => a.roundsSurvived - b.roundsSurvived);
    return completed;
  }

  async listFinishedRuns(): Promise<StoredRun[]> {
    return [...this.runs.values()]
      .filter(run => run.status !== 'playing')
      .map(cloneRun);
  }

  async deleteRunsOlderThan(isoDate: string): Promise<number> {
    let removed = 0;
    for (const [runId, run] of this.runs) {
      const reference = run.completedAt ?? run.updatedAt;
      if (reference < isoDate) {
        this.runs.delete(runId);
        removed += 1;
      }
    }
    return removed;
  }

  async close(): Promise<void> {
    this.runs.clear();
  }
}