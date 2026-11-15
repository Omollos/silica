import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import type { Logger } from './logger';

export type ApiErrorCode =
  | 'invalid_body'
  | 'unknown_choice'
  | 'illegal_choice'
  | 'round_mismatch'
  | 'choices_after_end'
  | 'run_conflict'
  | 'run_finished'
  | 'not_found'
  | 'rate_limited'
  | 'unauthorized'
  | 'server_error';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;

  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function notFound(message = 'Resource not found.'): ApiError {
  return new ApiError(404, 'not_found', message);
}

export function invalidBody(message = 'Request body is invalid.'): ApiError {
  return new ApiError(400, 'invalid_body', message);
}

/** Wrap async handlers so rejected promises always reach the JSON error handler. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

interface HttpishError {
  status?: number;
  statusCode?: number;
  type?: string;
  code?: string;
  message?: string;
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    if (err instanceof ApiError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }

    const candidate = (typeof err === 'object' && err !== null ? err : {}) as HttpishError;
    const status = candidate.status ?? candidate.statusCode;

    // body-parser: malformed JSON, oversized body, or wrong charset.
    if (candidate.type === 'entity.too.large' || status === 413) {
      // The API contract reports an oversized body as 400 invalid_body.
      res.status(400).json({ error: { code: 'invalid_body', message: 'Request body is too large.' } });
      return;
    }
    if (status === 400 && (candidate.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
      res.status(400).json({ error: { code: 'invalid_body', message: 'Request body is invalid JSON.' } });
      return;
    }

    logger.error('request failed', {
      method: req.method,
      path: req.path,
      err: candidate.message ?? 'unknown error',
    });
    res.status(500).json({ error: { code: 'server_error', message: 'Something went wrong.' } });
  };
}
