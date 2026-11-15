import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { StoredRun } from '../db/store';
import { createTestApp, testConfig } from './helpers';

function storedRun(overrides: Partial<StoredRun>): StoredRun {
  return {
    runId: 'run_admin_finished',
    seed: 1,
    difficulty: 'standard',
    liveFlareBonus: 0,
    status: 'won',
    failureReason: null,
    roundsSurvived: 12,
    score: 88,
    finalPower: 20,
    finalOxygen: 18,
    finalHealth: 88,
    finalMoonDirt: 5,
    finalShield: 30,
    verified: true,
    mismatch: [],
    report: null,
    startedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:10:00.000Z',
    completedAt: '2026-01-01T00:10:00.000Z',
    choices: [{ round: 1, choiceId: 'dirt_air' }],
    ...overrides,
  };
}

describe('GET /api/admin/export.csv', () => {
  it('is disabled with 404 when ADMIN_TOKEN is unset', async () => {
    const { app } = createTestApp();
    const response = await request(app).get('/api/admin/export.csv');
    expect(response.status).toBe(404);
  });

  it('requires a constant-time bearer token', async () => {
    const { app } = createTestApp({
      config: testConfig({ ADMIN_TOKEN: 'a-very-secret-token' }),
    });

    const missing = await request(app).get('/api/admin/export.csv');
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe('unauthorized');

    const wrong = await request(app)
      .get('/api/admin/export.csv')
      .set('Authorization', 'Bearer nope');
    expect(wrong.status).toBe(401);

    const malformed = await request(app)
      .get('/api/admin/export.csv')
      .set('Authorization', 'a-very-secret-token');
    expect(malformed.status).toBe(401);
  });

  it('exports only finished runs with no identifiers', async () => {
    const { app, store } = createTestApp({
      config: testConfig({ ADMIN_TOKEN: 'a-very-secret-token' }),
    });
    await store.saveRun(storedRun({}));
    await store.saveRun(
      storedRun({
        runId: 'run_admin_playing',
        status: 'playing',
        roundsSurvived: 3,
        completedAt: null,
        score: null,
      })
    );

    const response = await request(app)
      .get('/api/admin/export.csv')
      .set('Authorization', 'Bearer a-very-secret-token');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text.split('\n')[0]).toBe(
      'run_id,seed,difficulty,live_flare_bonus,status,failure_reason,rounds_survived,score,final_power,final_oxygen,final_health,final_moon_dirt,final_shield,verified,started_at,completed_at,choices'
    );
    expect(response.text).toContain('run_admin_finished');
    expect(response.text).not.toContain('run_admin_playing');
    expect(response.text).toContain('1:dirt_air');
    expect(response.text.toLowerCase()).not.toContain('ip_address');
    expect(response.text.toLowerCase()).not.toContain('user_agent');
  });
});
