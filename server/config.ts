import { z } from 'zod';
import type { LogLevel } from './logger';
import packageJson from '../package.json';

export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  dataDir: string;
  databaseUrl: string | null;
  nasaApiKey: string;
  corsOrigins: string[];
  trustProxy: number | false;
  retentionDays: number;
  adminToken: string | null;
  logLevel: LogLevel;
  version: string;
  upstreamTimeoutMs: number;
  upstreamLongTimeoutMs: number;
  nasaFetchTimeoutMs: number;
  nasaSnapshotDir: string;
  radlabWindowStart: string;
  radlabWindowEnd: string;
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z
    .string()
    .optional()
    .transform(value => (value === undefined || value === '' ? 3000 : Number(value)))
    .pipe(z.number().int().min(1).max(65535)),
  DATA_DIR: z.string().min(1).default('./data'),
  DATABASE_URL: z.string().min(1).optional(),
  NASA_API_KEY: z.string().min(1).default('DEMO_KEY'),
  CORS_ORIGINS: z.string().optional(),
  TRUST_PROXY: z.string().optional(),
  RETENTION_DAYS: z
    .string()
    .optional()
    .transform(value => (value === undefined || value === '' ? 365 : Number(value)))
    .pipe(z.number().int().min(1).max(36500)),
  ADMIN_TOKEN: z.string().min(1).optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),
  NASA_FETCH_TIMEOUT_MS: z
    .string()
    .optional()
    .transform(value => (value === undefined || value === '' ? 8000 : Number(value)))
    .pipe(z.number().int().min(1000).max(30_000)),
  // Empty string disables snapshot persistence on disk.
  NASA_SNAPSHOT_DIR: z.string().default('./data/nasa'),
  RADLAB_WINDOW_START: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'must look like 2022-04-01T23:00')
    .default('2022-04-01T23:00'),
  RADLAB_WINDOW_END: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'must look like 2022-04-02T01:05')
    .default('2022-04-02T01:05'),
});

function parseTrustProxy(raw: string | undefined): number | false {
  if (raw === undefined || raw === '' || raw === 'false' || raw === '0') return false;
  if (raw === 'true') return 1;
  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 1) {
    throw new Error('TRUST_PROXY must be "true", "false", or a positive hop count');
  }
  return hops;
}

function parseOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);
}

/**
 * Parse and validate environment variables once at startup. Any invalid value
 * throws immediately so a misconfiguration never reaches a child's session.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map(issue => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${detail}`);
  }
  const data = parsed.data;

  return {
    nodeEnv: data.NODE_ENV,
    port: data.PORT,
    dataDir: data.DATA_DIR,
    databaseUrl: data.DATABASE_URL ?? null,
    nasaApiKey: data.NASA_API_KEY,
    corsOrigins: parseOrigins(data.CORS_ORIGINS),
    trustProxy: parseTrustProxy(data.TRUST_PROXY),
    retentionDays: data.RETENTION_DAYS,
    adminToken: data.ADMIN_TOKEN ?? null,
    logLevel: data.LOG_LEVEL,
    version: typeof packageJson.version === 'string' ? packageJson.version : '0.0.0',
    upstreamTimeoutMs: data.NASA_FETCH_TIMEOUT_MS,
    upstreamLongTimeoutMs: Math.min(9000, data.NASA_FETCH_TIMEOUT_MS + 1000),
    nasaFetchTimeoutMs: data.NASA_FETCH_TIMEOUT_MS,
    nasaSnapshotDir: data.NASA_SNAPSHOT_DIR,
    radlabWindowStart: data.RADLAB_WINDOW_START,
    radlabWindowEnd: data.RADLAB_WINDOW_END,
  };
}
