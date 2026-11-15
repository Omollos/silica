import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import type { StoredRun, Store } from '../db/store';
import { ApiError, asyncHandler, notFound } from '../errors';

export interface AdminRouterOptions {
  store: Store;
  adminToken: string | null;
}

function constantTimeEquals(received: string, expected: string): boolean {
  const receivedBytes = Buffer.from(received, 'utf8');
  const expectedBytes = Buffer.from(expected, 'utf8');
  if (receivedBytes.length !== expectedBytes.length) {
    // Still do one comparison so the failure path takes similar time.
    timingSafeEqual(expectedBytes, expectedBytes);
    return false;
  }
  return timingSafeEqual(receivedBytes, expectedBytes);
}

function csvCell(value: string | number | boolean | null): string {
  if (value === null) return '';
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(runs: StoredRun[]): string {
  const columns = [
    'run_id',
    'seed',
    'difficulty',
    'live_flare_bonus',
    'status',
    'failure_reason',
    'rounds_survived',
    'score',
    'final_power',
    'final_oxygen',
    'final_health',
    'final_moon_dirt',
    'final_shield',
    'verified',
    'started_at',
    'completed_at',
    'choices',
  ];

  const lines = [columns.join(',')];
  for (const run of runs) {
    const choices = run.choices.map(choice => `${choice.round}:${choice.choiceId}`).join(';');
    lines.push(
      [
        csvCell(run.runId),
        csvCell(run.seed),
        csvCell(run.difficulty),
        csvCell(run.liveFlareBonus),
        csvCell(run.status),
        csvCell(run.failureReason),
        csvCell(run.roundsSurvived),
        csvCell(run.score),
        csvCell(run.finalPower),
        csvCell(run.finalOxygen),
        csvCell(run.finalHealth),
        csvCell(run.finalMoonDirt),
        csvCell(run.finalShield),
        csvCell(run.verified),
        csvCell(run.startedAt),
        csvCell(run.completedAt),
        csvCell(choices),
      ].join(',')
    );
  }
  return `${lines.join('\n')}\n`;
}

export function createAdminRouter(options: AdminRouterOptions): Router {
  const router = Router();

  router.get(
    '/api/admin/export.csv',
    asyncHandler(async (req, res) => {
      if (!options.adminToken) {
        throw notFound();
      }

      const header = req.headers.authorization ?? '';
      const match = /^Bearer (.+)$/.exec(header);
      if (!match || !constantTimeEquals(match[1], options.adminToken)) {
        throw new ApiError(401, 'unauthorized', 'Invalid admin token.');
      }

      const runs = await options.store.listFinishedRuns();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="silica-runs.csv"');
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).send(toCsv(runs));
    })
  );

  return router;
}
