import { Router } from 'express';
import { z } from 'zod';
import type { MissionReport } from '../../src/types';
import type { RunStatus, StoredRun, Store } from '../db/store';
import { ApiError, asyncHandler, notFound } from '../errors';
import { createRateLimiter, type RateLimits } from '../middleware/rateLimit';
import { parseBody, validateRunId } from '../middleware/validate';
import { replayRun } from '../services/replay';

const choiceSchema = z
  .object({
    round: z.number().int().min(1).max(12),
    choiceId: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9_]+$/, 'choiceId must be a lowercase identifier'),
  })
  .strict();

const clientSummarySchema = z
  .object({
    status: z.enum(['playing', 'won', 'partial', 'lost']).optional(),
    round: z.number().int().min(1).max(12).optional(),
    power: z.number().finite().optional(),
    oxygen: z.number().finite().optional(),
    health: z.number().finite().optional(),
  })
  .strict();

const putRunSchema = z
  .object({
    seed: z.number().int().min(0).max(2_147_483_647),
    difficulty: z.enum(['cadet', 'standard', 'commander']),
    liveFlareBonus: z.union([z.literal(0), z.literal(5), z.literal(10)]),
    // Additive from the NASA prompt: which daily snapshot the client pinned.
    // Replay only needs liveFlareBonus, so this is validated and not stored.
    nasaSnapshotId: z.string().min(1).max(64).optional(),
    choices: z.array(choiceSchema).max(12),
    clientSummary: clientSummarySchema.optional(),
  })
  .strict();

export interface RunResponse {
  runId: string;
  verified: boolean;
  status: RunStatus;
  round: number;
  report: MissionReport | null;
  mismatch: string[];
}

interface RunSummaryResponse {
  runId: string;
  seed: number;
  difficulty: StoredRun['difficulty'];
  liveFlareBonus: number;
  status: RunStatus;
  failureReason: StoredRun['failureReason'];
  roundsSurvived: number;
  score: number | null;
  finalPower: number | null;
  finalOxygen: number | null;
  finalHealth: number | null;
  finalMoonDirt: number | null;
  finalShield: number | null;
  verified: boolean;
  mismatch: string[];
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  choices: StoredRun['choices'];
  report: MissionReport | null;
}

export interface RunsRouterOptions {
  store: Store;
  now: () => number;
  rateLimits: RateLimits;
}

function sameChoices(a: StoredRun['choices'], b: StoredRun['choices']): boolean {
  return (
    a.length === b.length &&
    a.every(
      (choice, index) =>
        choice.round === b[index].round && choice.choiceId === b[index].choiceId
    )
  );
}

function toSummaryResponse(run: StoredRun): RunSummaryResponse {
  return {
    runId: run.runId,
    seed: run.seed,
    difficulty: run.difficulty,
    liveFlareBonus: run.liveFlareBonus,
    status: run.status,
    failureReason: run.failureReason,
    roundsSurvived: run.roundsSurvived,
    score: run.score,
    finalPower: run.finalPower,
    finalOxygen: run.finalOxygen,
    finalHealth: run.finalHealth,
    finalMoonDirt: run.finalMoonDirt,
    finalShield: run.finalShield,
    verified: run.verified,
    mismatch: [...run.mismatch],
    startedAt: run.startedAt,
    updatedAt: run.updatedAt,
    completedAt: run.completedAt,
    choices: run.choices.map(choice => ({ ...choice })),
    report: run.report,
  };
}

export function createRunsRouter(options: RunsRouterOptions): Router {
  const router = Router();
  const { store, rateLimits } = options;

  const writeLimiter = createRateLimiter({
    windowMs: rateLimits.windowMs,
    limit: rateLimits.runsPut,
    enabled: rateLimits.enabled,
  });
  const readLimiter = createRateLimiter({
    windowMs: rateLimits.windowMs,
    limit: rateLimits.runsRead,
    enabled: rateLimits.enabled,
  });

  router.put(
    '/api/runs/:runId',
    writeLimiter,
    asyncHandler(async (req, res) => {
      const runId = validateRunId(req.params.runId);
      const body = parseBody(putRunSchema, req);
      const existing = await store.getRun(runId);

      if (existing && existing.status !== 'playing') {
        const identical = sameChoices(existing.choices, body.choices);
        const sameSetup =
          existing.seed === body.seed &&
          existing.difficulty === body.difficulty &&
          existing.liveFlareBonus === body.liveFlareBonus;
        if (!identical || !sameSetup) {
          throw new ApiError(409, 'run_finished', 'This run has already finished and cannot change.');
        }
        // Identical resend: return the stored authoritative result.
        const response: RunResponse = {
          runId: existing.runId,
          verified: existing.verified,
          status: existing.status,
          round: existing.roundsSurvived,
          report: existing.report,
          mismatch: [...existing.mismatch],
        };
        res.status(200).json(response);
        return;
      }

      let choices = body.choices;
      if (existing) {
        if (
          existing.seed !== body.seed ||
          existing.difficulty !== body.difficulty ||
          existing.liveFlareBonus !== body.liveFlareBonus
        ) {
          throw new ApiError(
            409,
            'run_conflict',
            'A run with this id already exists with a different seed, difficulty or flare bonus.'
          );
        }

        const storedByRound = new Map(
          existing.choices.map(choice => [choice.round, choice.choiceId] as const)
        );
        for (const choice of body.choices) {
          const storedChoice = storedByRound.get(choice.round);
          if (storedChoice !== undefined && storedChoice !== choice.choiceId) {
            throw new ApiError(409, 'run_conflict', 'A choice for this round is already stored.');
          }
        }

        // Progressive sync: keep everything already stored and append newer rounds.
        const merged = new Map<number, string>();
        for (const choice of existing.choices) merged.set(choice.round, choice.choiceId);
        for (const choice of body.choices) merged.set(choice.round, choice.choiceId);
        choices = [...merged.entries()]
          .map(([round, choiceId]) => ({ round, choiceId }))
          .sort((a, b) => a.round - b.round);
      }

      const outcome = replayRun({
        runId,
        seed: body.seed,
        difficulty: body.difficulty,
        liveFlareBonus: body.liveFlareBonus,
        choices,
      });

      const mismatch: string[] = [];
      const summary = body.clientSummary;
      if (summary) {
        if (summary.status !== undefined && summary.status !== outcome.state.status) {
          mismatch.push('status');
        }
        if (summary.round !== undefined && summary.round !== outcome.state.round) {
          mismatch.push('round');
        }
        if (summary.power !== undefined && summary.power !== outcome.state.power) {
          mismatch.push('power');
        }
        if (summary.oxygen !== undefined && summary.oxygen !== outcome.state.oxygen) {
          mismatch.push('oxygen');
        }
        if (summary.health !== undefined && summary.health !== outcome.state.health) {
          mismatch.push('health');
        }
      }

      const verified = mismatch.length === 0;
      const report = outcome.report;
      const finished = outcome.state.status !== 'playing';
      const timestamp = new Date(options.now()).toISOString();

      const record: StoredRun = {
        runId,
        seed: body.seed,
        difficulty: body.difficulty,
        liveFlareBonus: body.liveFlareBonus,
        status: outcome.state.status,
        failureReason: outcome.state.failureReason,
        roundsSurvived: report ? report.roundsSurvived : outcome.state.trace.length,
        score: report ? report.score : null,
        finalPower: report ? report.finalPower : null,
        finalOxygen: report ? report.finalOxygen : null,
        finalHealth: report ? report.finalHealth : null,
        finalMoonDirt: report ? report.finalMoonDirt : null,
        finalShield: report ? report.finalShield : null,
        verified,
        mismatch,
        report,
        startedAt: existing ? existing.startedAt : timestamp,
        updatedAt: timestamp,
        completedAt: finished ? (existing?.completedAt ?? timestamp) : null,
        choices: outcome.choices,
      };

      await store.saveRun(record);

      const response: RunResponse = {
        runId,
        verified,
        status: record.status,
        round: outcome.state.round,
        report,
        mismatch,
      };
      res.status(existing ? 200 : 201).json(response);
    })
  );

  router.get(
    '/api/runs/:runId',
    readLimiter,
    asyncHandler(async (req, res) => {
      const runId = validateRunId(req.params.runId);
      const run = await store.getRun(runId);
      if (!run) throw notFound('Run not found.');
      res.json(toSummaryResponse(run));
    })
  );

  return router;
}
