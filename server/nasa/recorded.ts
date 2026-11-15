import { readFileSync } from 'node:fs';
import path from 'node:path';
import { recordedFileSchema, type RecordedFile } from './schemas';

/**
 * Reads the real NASA recording produced by `bun run record:nasa`.
 *
 * This file is never hand-written and is not required: when it is missing the
 * server simply serves neutral responses instead of pretending to have data.
 */
export const RECORDED_FILE_PATH = path.resolve(
  process.cwd(),
  'src/content/nasa-recorded.json'
);

let cache: { path: string; data: RecordedFile | null } | null = null;

export function readRecordedFile(filePath: string = RECORDED_FILE_PATH): RecordedFile | null {
  if (cache && cache.path === filePath) return cache.data;
  let data: RecordedFile | null = null;
  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = recordedFileSchema.safeParse(JSON.parse(raw));
    data = parsed.success ? parsed.data : null;
  } catch {
    data = null;
  }
  cache = { path: filePath, data };
  return data;
}

/** Test helper: forget the cached recording. */
export function clearRecordedCache(): void {
  cache = null;
}
