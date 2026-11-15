import type { GameState, MissionReport } from '../types';

/**
 * Fire-and-forget sync with the optional backend. The game never waits for it,
 * never shows an error and never depends on it: every failure is swallowed.
 */

export interface RunResponse {
  runId: string;
  verified: boolean;
  status: 'playing' | 'won' | 'partial' | 'lost';
  round: number;
  report: MissionReport | null;
  mismatch: string[];
}

export interface ChoicePopularityEntry {
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
  byDifficulty: Record<
    'cadet' | 'standard' | 'commander',
    { runs: number; won: number; partial: number; lost: number }
  >;
  endRound: { round: number; count: number }[];
  choicePopularity: ChoicePopularityEntry[];
}

export interface RunPayload {
  seed: number;
  difficulty: GameState['difficulty'];
  liveFlareBonus: number;
  /** Which daily NASA snapshot the run was pinned to (optional, additive). */
  nasaSnapshotId?: string;
  choices: { round: number; choiceId: string }[];
  clientSummary: {
    status: GameState['status'];
    round: number;
    power: number;
    oxygen: number;
    health: number;
  };
}

interface PendingRun {
  runId: string;
  payload: RunPayload;
}

const PENDING_KEY = 'silica.pendingRuns';
const MAX_PENDING = 20;
const REQUEST_TIMEOUT_MS = 5000;

export function buildRunPayload(
  state: GameState,
  nasaSnapshotId?: string
): RunPayload {
  return {
    seed: state.seed,
    difficulty: state.difficulty,
    liveFlareBonus: state.liveFlareBonus ?? 0,
    ...(nasaSnapshotId && nasaSnapshotId !== 'none' ? { nasaSnapshotId } : {}),
    choices: state.trace.map(entry => ({
      round: entry.round,
      choiceId: entry.choiceId,
    })),
    clientSummary: {
      status: state.status,
      round: state.round,
      power: state.power,
      oxygen: state.oxygen,
      health: state.health,
    },
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function storageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPendingRun(value: unknown): value is PendingRun {
  if (!isRecord(value)) return false;
  if (typeof value.runId !== 'string' || !isRecord(value.payload)) return false;
  return (
    typeof value.payload.seed === 'number' &&
    typeof value.payload.difficulty === 'string' &&
    Array.isArray(value.payload.choices)
  );
}

function readPending(): PendingRun[] {
  if (!storageAvailable()) return [];
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPendingRun);
  } catch {
    return [];
  }
}

function writePending(items: PendingRun[]): void {
  if (!storageAvailable()) return;
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(items.slice(-MAX_PENDING)));
  } catch {
    // Private mode or a full quota: saving is optional, never break the game.
  }
}

function enqueuePending(runId: string, payload: RunPayload): void {
  const items = readPending().filter(item => item.runId !== runId);
  items.push({ runId, payload });
  writePending(items);
}

function removePending(runId: string): void {
  const items = readPending();
  if (items.some(item => item.runId === runId)) {
    writePending(items.filter(item => item.runId !== runId));
  }
}

async function putRun(runId: string, payload: RunPayload): Promise<Response> {
  return fetchWithTimeout(
    `/api/runs/${encodeURIComponent(runId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    REQUEST_TIMEOUT_MS
  );
}

/**
 * Saves the current run. Network failures, timeouts and 5xx responses are
 * queued for a later retry; 4xx responses are invalid and are never retried.
 */
export async function syncRun(state: GameState, nasaSnapshotId?: string): Promise<void> {
  const payload = buildRunPayload(state, nasaSnapshotId);
  try {
    const response = await putRun(state.runId, payload);
    if (response.ok) {
      removePending(state.runId);
      return;
    }
    if (response.status >= 400 && response.status < 500) return;
    enqueuePending(state.runId, payload);
  } catch {
    enqueuePending(state.runId, payload);
  }
}

let flushing = false;

/** Retries unsent runs. Safe to call often; failures stay queued. */
export async function flushPendingRuns(): Promise<void> {
  if (flushing) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const items = readPending();
  if (items.length === 0) return;

  flushing = true;
  const remaining: PendingRun[] = [];
  try {
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      try {
        const response = await putRun(item.runId, item.payload);
        if (!response.ok && response.status >= 500) {
          remaining.push(item);
        }
      } catch {
        // The backend looks unreachable: keep this run and the rest for the
        // next online event instead of waiting on a timeout for each one.
        remaining.push(...items.slice(index));
        break;
      }
    }
  } finally {
    writePending(remaining);
    flushing = false;
  }
}

/** Anonymous aggregates for the future "For grown-ups" screen. */
export async function fetchStats(): Promise<StatsResponse | null> {
  try {
    const response = await fetchWithTimeout('/api/stats', { method: 'GET' }, REQUEST_TIMEOUT_MS);
    if (!response.ok) return null;
    return (await response.json()) as StatsResponse;
  } catch {
    return null;
  }
}
