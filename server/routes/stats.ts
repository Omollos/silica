import { Router } from 'express';
import { asyncHandler } from '../errors';
import { createRateLimiter, type RateLimits } from '../middleware/rateLimit';
import type { StatsService } from '../services/stats';

export interface StatsRouterOptions {
  stats: StatsService;
  rateLimits: RateLimits;
}

export function createStatsRouter(options: StatsRouterOptions): Router {
  const router = Router();

  router.get(
    '/api/stats',
    createRateLimiter({
      windowMs: options.rateLimits.windowMs,
      limit: options.rateLimits.stats,
      enabled: options.rateLimits.enabled,
    }),
    asyncHandler(async (_req, res) => {
      const stats = await options.stats.get();
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.json(stats);
    })
  );

  return router;
}
