import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';

export interface RateLimitOptions {
  windowMs: number;
  limit: number;
  enabled: boolean;
}

export interface RateLimits {
  windowMs: number;
  runsPut: number;
  runsRead: number;
  stats: number;
  nasa: number;
  enabled: boolean;
}

export const DEFAULT_RATE_LIMITS: RateLimits = {
  windowMs: 60_000,
  runsPut: 30,
  runsRead: 60,
  stats: 60,
  nasa: 30,
  enabled: true,
};

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  if (!options.enabled) {
    return (_req, _res, next) => next();
  }
  const windowSeconds = Math.max(1, Math.ceil(options.windowMs / 1000));
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // Only the in-memory key (the client IP) is used; it is never stored or logged.
    handler: (_req, res) => {
      res.setHeader('Retry-After', String(windowSeconds));
      res.status(429).json({
        error: {
          code: 'rate_limited',
          message: 'Too many requests. Please wait a moment and try again.',
        },
      });
    },
  });
}
