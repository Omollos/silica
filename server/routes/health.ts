import { Router } from 'express';
import type { AppConfig } from '../config';
import type { Store } from '../db/store';
import { asyncHandler } from '../errors';

export interface HealthRouterOptions {
  store: Store;
  config: AppConfig;
  startedAt: number;
  now: () => number;
}

export function createHealthRouter(options: HealthRouterOptions): Router {
  const router = Router();

  router.get(
    '/api/health',
    asyncHandler(async (_req, res) => {
      let databaseOk = false;
      try {
        databaseOk = await options.store.checkHealth();
      } catch {
        databaseOk = false;
      }

      const body = {
        status: databaseOk ? 'ok' : 'error',
        version: options.config.version,
        db: databaseOk ? 'ok' : 'error',
        uptimeSeconds: Math.max(
          0,
          Math.floor((options.now() - options.startedAt) / 1000)
        ),
      };

      res.status(databaseOk ? 200 : 503).json(body);
    })
  );

  return router;
}
