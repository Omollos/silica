import type { Request } from 'express';
import type { z } from 'zod';
import { invalidBody } from '../errors';

export const RUN_ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;

export function validateRunId(raw: unknown): string {
  if (typeof raw !== 'string' || !RUN_ID_PATTERN.test(raw)) {
    throw invalidBody('runId must match ^[A-Za-z0-9_-]{6,64}$.');
  }
  return raw;
}

/**
 * Parse a request body with a strict zod schema. Unknown keys, free text and
 * wrong types all become the same 400 invalid_body response, so the server
 * never echoes back what a child may have typed.
 */
export function parseBody<T extends z.ZodType>(schema: T, req: Request): z.infer<T> {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    throw invalidBody();
  }
  return result.data as z.infer<T>;
}
