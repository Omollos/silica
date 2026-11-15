import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildReport, getRoundView, startGame, submitChoice } from '../../src/engine';
import type { GameState, RoundView } from '../../src/types';
import type { RunChoiceRecord } from '../db/store';
import { createTestApp } from './helpers';

const WIN_PATH = [
  'dirt_air',
  'heat_on',
  'dirt_shield',
  'clean_yes',
  'dirt_build',
  'delay_greenhouse',
  'heat_on',
  'flare_shelter',
  'heat_on',
  'clean_yes',
  'exercise_yes',
  'heat_on',
];

const CARELESS_PREFERENCES = [
  'dirt_build',
  'heat_off',
  'clean_skip',
  'delay_air',
  'treat_rest',
  'flare_work',
  'exercise_skip',
  'leak_ignore',
  'ice_stay',
];

function toChoices(path: string[]): RunChoiceRecord[] {
  return path.map((choiceId, index) => ({ round: index + 1, choiceId }));
}

function simulate(preferences: string[]): { state: GameState; picks: RunChoiceRecord[] } {
  let state = startGame(1, 'standard', 0);
  const picks: RunChoiceRecord[] = [];

  while (state.status === 'playing' && picks.length < 12) {
    const view: RoundView = getRoundView(state);
    let chosen = view.choices.find(
      choice => preferences.includes(choice.id) && !choice.disabled
    );
    if (!chosen) chosen = view.choices.find(choice => !choice.disabled);
    if (!chosen) throw new Error('engine deadlock');
    picks.push({ round: state.round, choiceId: chosen.id });
    state = submitChoice(state, chosen.id);
  }

  return { state, picks };
}

function body(overrides: Record<string, unknown> = {}) {
  return {
    seed: 1,
    difficulty: 'standard',
    liveFlareBonus: 0,
    choices: [] as RunChoiceRecord[],
    ...overrides,
  };
}

describe('PUT /api/runs/:runId', () => {
  it('accepts the additive nasaSnapshotId field without changing the stored run', async () => {
    const { app } = createTestApp();
    const response = await request(app)
      .put('/api/runs/run_snapshot_pin_1')
      .send(
        body({
          nasaSnapshotId: '2026-11-15',
          choices: [{ round: 1, choiceId: 'dirt_air' }],
        })
      );

    expect(response.status).toBe(201);
    expect(response.body.verified).toBe(true);

    const fetched = await request(app).get('/api/runs/run_snapshot_pin_1');
    expect(fetched.status).toBe(200);
    expect(fetched.body.liveFlareBonus).toBe(0);
    expect(fetched.body).not.toHaveProperty('nasaSnapshotId');
  });

  it('returns 201 on first write, 200 on an identical resend, and extends a longer list', async () => {
    const { app } = createTestApp();
    const runId = 'run_idempotent_1';

    const first = await request(app)
      .put(`/api/runs/${runId}`)
      .send(body({ choices: [{ round: 1, choiceId: 'dirt_air' }] }));

    expect(first.status).toBe(201);
    expect(first.body).toEqual({
      runId,
      verified: true,
      status: 'playing',
      round: 2,
      report: null,
      mismatch: [],
    });

    const resend = await request(app)
      .put(`/api/runs/${runId}`)
      .send(body({ choices: [{ round: 1, choiceId: 'dirt_air' }] }));

    expect(resend.status).toBe(200);
    expect(resend.body).toEqual(first.body);

    const extended = await request(app)
      .put(`/api/runs/${runId}`)
      .send(
        body({
          choices: [
            { round: 1, choiceId: 'dirt_air' },
            { round: 2, choiceId: 'heat_on' },
          ],
        })
      );

    expect(extended.status).toBe(200);
    expect(extended.body.status).toBe('playing');
    expect(extended.body.round).toBe(3);

    const stored = await request(app).get(`/api/runs/${runId}`);
    expect(stored.status).toBe(200);
    expect(stored.body.choices).toEqual([
      { round: 1, choiceId: 'dirt_air' },
      { round: 2, choiceId: 'heat_on' },
    ]);
    expect(stored.body.roundsSurvived).toBe(2);
    expect(stored.body.report).toBeNull();
  });

  it('returns 409 run_conflict when a stored round changes', async () => {
    const { app } = createTestApp();
    const runId = 'run_conflict_1';

    await request(app)
      .put(`/api/runs/${runId}`)
      .send(body({ choices: [{ round: 1, choiceId: 'dirt_air' }] }));

    const conflict = await request(app)
      .put(`/api/runs/${runId}`)
      .send(body({ choices: [{ round: 1, choiceId: 'dirt_build' }] }));

    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('run_conflict');

    const setupConflict = await request(app)
      .put(`/api/runs/${runId}`)
      .send(body({ seed: 42, choices: [{ round: 1, choiceId: 'dirt_air' }] }));

    expect(setupConflict.status).toBe(409);
    expect(setupConflict.body.error.code).toBe('run_conflict');
  });

  it('returns 409 run_finished for any change to a finished run but 200 for an identical resend', async () => {
    const { app } = createTestApp();
    const runId = 'run_finished_1';
    const choices = toChoices(WIN_PATH);

    const first = await request(app).put(`/api/runs/${runId}`).send(body({ choices }));
    expect(first.status).toBe(201);
    expect(first.body.status).toBe('won');
    expect(first.body.report).not.toBeNull();

    const identical = await request(app).put(`/api/runs/${runId}`).send(body({ choices }));
    expect(identical.status).toBe(200);
    expect(identical.body).toEqual(first.body);

    const changedChoice = choices.map(choice =>
      choice.round === 12 ? { ...choice, choiceId: 'heat_off' } : choice
    );
    const changed = await request(app)
      .put(`/api/runs/${runId}`)
      .send(body({ choices: changedChoice }));
    expect(changed.status).toBe(409);
    expect(changed.body.error.code).toBe('run_finished');

    const shorter = await request(app)
      .put(`/api/runs/${runId}`)
      .send(body({ choices: choices.slice(0, 11) }));
    expect(shorter.status).toBe(409);
    expect(shorter.body.error.code).toBe('run_finished');

    const changedSeed = await request(app)
      .put(`/api/runs/${runId}`)
      .send(body({ seed: 42, choices }));
    expect(changedSeed.status).toBe(409);
    expect(changedSeed.body.error.code).toBe('run_finished');
  });

  it('flags a forged client summary as unverified and stores the server replay values', async () => {
    const { app } = createTestApp();
    const runId = 'run_forged_1';
    const lost = simulate(CARELESS_PREFERENCES);

    expect(lost.state.status).toBe('lost');

    const response = await request(app)
      .put(`/api/runs/${runId}`)
      .send(
        body({
          choices: lost.picks,
          clientSummary: {
            status: 'won',
            round: 12,
            power: 999,
            oxygen: 999,
            health: 999,
          },
        })
      );

    expect(response.status).toBe(201);
    expect(response.body.verified).toBe(false);
    expect(response.body.status).toBe('lost');
    expect(response.body.mismatch).toEqual(
      expect.arrayContaining(['status', 'round', 'power', 'oxygen', 'health'])
    );

    const stored = await request(app).get(`/api/runs/${runId}`);
    expect(stored.status).toBe(200);
    expect(stored.body.verified).toBe(false);
    expect(stored.body.status).toBe('lost');
    expect(stored.body.score).toBe(0);
    expect(stored.body.finalPower).toBe(lost.state.power);
    expect(stored.body.finalOxygen).toBe(lost.state.oxygen);
    expect(stored.body.finalHealth).toBe(lost.state.health);
    expect(stored.body.score).not.toBe(100);
    expect(stored.body.report.score).toBe(0);
    expect(stored.body.report.outcome).toBe('lost');
  });

  it('stores a verified summary when the client agrees with the replay', async () => {
    const { app } = createTestApp();
    const lost = simulate(CARELESS_PREFERENCES);
    const runId = 'run_verified_lost';

    const response = await request(app)
      .put(`/api/runs/${runId}`)
      .send(
        body({
          choices: lost.picks,
          clientSummary: {
            status: lost.state.status,
            round: lost.state.round,
            power: lost.state.power,
            oxygen: lost.state.oxygen,
            health: lost.state.health,
          },
        })
      );

    expect(response.status).toBe(201);
    expect(response.body.verified).toBe(true);
    expect(response.body.mismatch).toEqual([]);
  });

  it('builds reports for both lost and won runs that match buildReport exactly', async () => {
    const { app } = createTestApp();

    const wonPicks = toChoices(WIN_PATH);
    let wonState = { ...startGame(1, 'standard', 0), runId: 'run_report_won' };
    for (const choice of wonPicks) wonState = submitChoice(wonState, choice.choiceId);

    const won = await request(app)
      .put('/api/runs/run_report_won')
      .send(body({ choices: wonPicks }));
    expect(won.status).toBe(201);
    expect(won.body.status).toBe('won');
    expect(won.body.report).toEqual(buildReport(wonState));

    const lost = simulate(CARELESS_PREFERENCES);
    const lostState = { ...lost.state, runId: 'run_report_lost' };
    const lostResponse = await request(app)
      .put('/api/runs/run_report_lost')
      .send(body({ choices: lost.picks }));
    expect(lostResponse.status).toBe(201);
    expect(lostResponse.body.status).toBe('lost');
    expect(lostResponse.body.report).toEqual(buildReport(lostState));
  });

  it('rejects invalid bodies with 400 invalid_body', async () => {
    const { app } = createTestApp();
    const cases: Record<string, unknown>[] = [
      body({ freeText: 'hello' }),
      body({ liveFlareBonus: 7 }),
      body({ seed: -1 }),
      body({ seed: 2_147_483_648 }),
      body({ difficulty: 'easy' }),
      body({ choices: [{ round: 0, choiceId: 'heat_on' }] }),
      body({ choices: [{ round: 1, choiceId: 'Heat On' }] }),
      body({ choices: [{ round: 1, choiceId: 'heat_on', note: 'free text' }] }),
      body({ clientSummary: { note: 'free text' } }),
      { seed: 1, difficulty: 'standard', liveFlareBonus: 0 },
    ];

    for (const payload of cases) {
      const response = await request(app).put('/api/runs/run_invalid_1').send(payload);
      expect(response.status, JSON.stringify(payload).slice(0, 80)).toBe(400);
      expect(response.body.error.code).toBe('invalid_body');
    }

    const oversized = await request(app)
      .put('/api/runs/run_invalid_1')
      .send(body({ padding: 'x'.repeat(25_000) }));
    expect(oversized.status).toBe(400);
    expect(oversized.body.error.code).toBe('invalid_body');
  });

  it('rejects bad run ids with 400', async () => {
    const { app } = createTestApp();

    for (const runId of ['short', 'bad id!', 'x'.repeat(65)]) {
      const response = await request(app)
        .put(`/api/runs/${encodeURIComponent(runId)}`)
        .send(body());
      expect(response.status, runId).toBe(400);
      expect(response.body.error.code).toBe('invalid_body');
    }
  });

  it('rejects unknown choices, wrong rounds and choices after the end with 422', async () => {
    const { app } = createTestApp();

    const unknown = await request(app)
      .put('/api/runs/run_unknown_choice')
      .send(body({ choices: [{ round: 1, choiceId: 'dragon_fire' }] }));
    expect(unknown.status).toBe(422);
    expect(unknown.body.error.code).toBe('unknown_choice');

    const wrongRound = await request(app)
      .put('/api/runs/run_wrong_round')
      .send(body({ choices: [{ round: 2, choiceId: 'heat_on' }] }));
    expect(wrongRound.status).toBe(422);
    expect(wrongRound.body.error.code).toBe('round_mismatch');

    const lost = simulate(CARELESS_PREFERENCES);
    const afterEnd = await request(app)
      .put('/api/runs/run_after_end')
      .send(
        body({
          choices: [
            ...lost.picks,
            { round: lost.state.round + 1, choiceId: 'heat_on' },
          ],
        })
      );
    expect(afterEnd.status).toBe(422);
    expect(afterEnd.body.error.code).toBe('choices_after_end');
  });

  it('returns 404 for an unknown run', async () => {
    const { app } = createTestApp();
    const response = await request(app).get('/api/runs/run_does_not_exist');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('not_found');
  });
});
