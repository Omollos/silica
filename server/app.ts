import { randomUUID } from 'node:crypto';
import express from 'express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { loadConfig, type AppConfig } from './config';
import type { Store } from './db/store';
import { errorHandler, notFound } from './errors';
import { createLogger, type Logger } from './logger';
import { DEFAULT_RATE_LIMITS, type RateLimits } from './middleware/rateLimit';
import { buildSecurityMiddleware } from './middleware/security';
import { createAdminRouter } from './routes/admin';
import { createHealthRouter } from './routes/health';
import { createNasaRouter } from './routes/nasa';
import { createRunsRouter } from './routes/runs';
import { createStatsRouter } from './routes/stats';
import type { RecordedFile } from './nasa/schemas';
import type { NasaSnapshotService } from './nasa/snapshot';
import type { FetchLike } from './services/nasaCache';
import { StatsService } from './services/stats';

export const BODY_LIMIT = '20kb';

export interface AppDependencies {
  store: Store;
  config?: AppConfig;
  logger?: Logger;
  nasaFetch?: FetchLike;
  now?: () => number;
  rateLimits?: Partial<RateLimits>;
  /** Injected in tests and scripts so no real recording file is needed. */
  nasaRecorded?: RecordedFile | null;
  nasaSnapshot?: NasaSnapshotService;
}

/** One JSON line per request: no IPs, no bodies, no query strings. */
function requestLogging(logger: Logger): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const started = process.hrtime.bigint();
    const requestId = randomUUID();
    res.setHeader('X-Request-Id', requestId);
    res.on('finish', () => {
      const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      logger.info('request', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Math.round(elapsedMs * 10) / 10,
        requestId,
      });
    });
    next();
  };
}

/**
 * Builds the API app. Static assets and Vite middleware are mounted by the
 * bootstrap in server.ts, keeping this fully testable with injected fakes.
 */
export function createApp(dependencies: AppDependencies): express.Express {
  const config = dependencies.config ?? loadConfig();
  const logger = dependencies.logger ?? createLogger({ level: config.logLevel });
  const now = dependencies.now ?? (() => Date.now());
  const nasaFetch: FetchLike =
    dependencies.nasaFetch ?? ((url, init) => fetch(url, init));
  const rateLimits: RateLimits = { ...DEFAULT_RATE_LIMITS, ...dependencies.rateLimits };
  const startedAt = now();

  const stats = new StatsService(dependencies.store, now);
  const app = express();

  app.disable('x-powered-by');
  if (config.trustProxy !== false) {
    app.set('trust proxy', config.trustProxy);
  }

  for (const middleware of buildSecurityMiddleware(config)) {
    app.use(middleware);
  }
  app.use(requestLogging(logger));
  app.use(express.json({ limit: BODY_LIMIT }));

  app.use(
    createHealthRouter({
      store: dependencies.store,
      config,
      startedAt,
      now,
    })
  );
  app.use(
    createRunsRouter({
      store: dependencies.store,
      now,
      rateLimits,
    })
  );
  app.use(createStatsRouter({ stats, rateLimits }));
  app.use(
    createNasaRouter({
      config,
      nasaFetch,
      now,
      rateLimits,
      recorded: dependencies.nasaRecorded,
      snapshot: dependencies.nasaSnapshot,
    })
  );
  app.use(createAdminRouter({ store: dependencies.store, adminToken: config.adminToken }));

  // Unknown /api routes get the JSON error shape, never the SPA.
  app.use('/api', (_req, _res, next) => next(notFound()));

  app.use(errorHandler(logger));

  return app;
}
