import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { runMigrations } from '../db/migrate';
import { SCHEMA_SQL } from '../db/schema';
import { createNasaFetch, createTestApp, expectExactKeys, testConfig } from './helpers';

const validRunBody = {
  seed: 1,
  difficulty: 'standard',
  liveFlareBonus: 0,
  choices: [],
};

describe('platform', () => {
  it('GET /api/health reports ok when the store is healthy', async () => {
    const { app } = createTestApp();
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expectExactKeys(response.body, ['status', 'version', 'db', 'uptimeSeconds']);
    expect(response.body.status).toBe('ok');
    expect(response.body.db).toBe('ok');
  });

  it('GET /api/health returns 503 when the store fails', async () => {
    const { app, store } = createTestApp();
    store.setHealthy(false);

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('error');
    expect(response.body.db).toBe('error');
  });

  it('rate limits PUT /api/runs with 429 and Retry-After', async () => {
    const { app } = createTestApp({
      rateLimits: { enabled: true, windowMs: 60_000, runsPut: 2 },
    });

    const first = await request(app).put('/api/runs/run_rate_limit_1').send(validRunBody);
    const second = await request(app).put('/api/runs/run_rate_limit_1').send(validRunBody);
    const third = await request(app).put('/api/runs/run_rate_limit_1').send(validRunBody);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.headers['retry-after']).toBe('60');
    expect(third.body.error.code).toBe('rate_limited');
  });

  it('sets a strict CSP in production that keeps the app same-origin only', async () => {
    const { app } = createTestApp({ config: testConfig({ NODE_ENV: 'production' }) });
    const response = await request(app).get('/api/health');
    const csp = String(response.headers['content-security-policy']);
    const scriptDirective = csp
      .split(';')
      .map(part => part.trim())
      .find(part => part.startsWith('script-src'));

    expect(csp).toContain("default-src 'self'");
    expect(scriptDirective).toBe("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('https://fonts.googleapis.com');
    expect(csp).toContain('https://fonts.gstatic.com');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('returns JSON not_found for unknown /api routes', async () => {
    const { app } = createTestApp();
    const response = await request(app).get('/api/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('not_found');
  });

  it('runs migrations idempotently', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    runMigrations(db);

    const versions = db
      .prepare('SELECT version FROM schema_migrations ORDER BY version')
      .all() as { version: number }[];
    expect(versions).toEqual([{ version: 1 }]);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map(table => table.name);
    expect(names).toContain('runs');
    expect(names).toContain('run_choices');
    db.close();
  });

  it('keeps schema.sql byte-identical with the migration source', () => {
    const documented = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
    expect(documented.trim()).toBe(SCHEMA_SQL.trim());
  });

  it('stores no identifying columns in the schema', () => {
    const sql = SCHEMA_SQL.toLowerCase();
    for (const forbidden of ['ip_address', 'user_agent', 'cookie', 'email', 'full_name', 'device']) {
      expect(sql).not.toContain(forbidden);
    }
  });

  it('never logs IP addresses, bodies, query strings or user agents', async () => {
    const lines: string[] = [];
    const nasa = createNasaFetch();
    const { app } = createTestApp({ logSink: line => lines.push(line), nasaFetch: nasa.fetch });

    await request(app)
      .put('/api/runs/run_privacy_check')
      .set('User-Agent', 'Mozilla/5.0 TestAgent')
      .set('X-Forwarded-For', '203.0.113.9')
      .send({ ...validRunBody, freeText: 'my name is Sam' });
    await request(app).get('/api/nasa/osdr?topic=bone');
    await request(app).get('/api/stats?secret=query-value');

    expect(lines.length).toBeGreaterThan(0);
    const combined = lines.join('\n');
    expect(combined).not.toContain('127.0.0.1');
    expect(combined).not.toContain('::1');
    expect(combined).not.toContain('203.0.113.9');
    expect(combined).not.toContain('Mozilla');
    expect(combined).not.toContain('my name is Sam');
    expect(combined).not.toContain('query-value');
    expect(combined.toLowerCase()).not.toContain('user-agent');

    for (const line of lines) {
      const entry = JSON.parse(line) as Record<string, unknown>;
      expect(entry).not.toHaveProperty('ip');
      expect(entry).not.toHaveProperty('body');
      expect(entry).not.toHaveProperty('query');
      expect(entry).not.toHaveProperty('headers');
      expect(entry).toHaveProperty('requestId');
    }
  });
});
