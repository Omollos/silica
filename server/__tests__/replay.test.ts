import { describe, expect, it } from 'vitest';
import { buildReport, getRoundView, startGame, submitChoice } from '../../src/engine';
import type { DifficultyMode, GameState, RoundView } from '../../src/types';
import type { RunChoiceRecord } from '../db/store';
import { replayRun } from '../services/replay';

const DIFFICULTIES: DifficultyMode[] = ['cadet', 'standard', 'commander'];
const FLARE_BONUSES = [0, 10];
const SEEDS = [1, 42];

interface Strategy {
  name: string;
  preferences: string[];
}

const STRATEGIES: Strategy[] = [
  {
    name: 'all heating on',
    preferences: [
      'heat_on',
      'treat_now',
      'clean_yes',
      'dirt_air',
      'dirt_shield',
      'flare_shelter',
      'exercise_yes',
      'delay_greenhouse',
      'dirt_build',
      'ice_send',
      'leak_patch',
    ],
  },
  {
    name: 'all heating off',
    preferences: [
      'heat_off',
      'treat_rest',
      'clean_skip',
      'dirt_build',
      'flare_work',
      'exercise_skip',
      'delay_eat_less',
      'dirt_air',
      'ice_stay',
      'leak_ignore',
    ],
  },
  {
    name: 'shield first',
    preferences: [
      'dirt_shield',
      'heat_on',
      'clean_yes',
      'flare_shelter',
      'exercise_yes',
      'delay_greenhouse',
      'treat_now',
      'dirt_build',
      'ice_send',
      'leak_patch',
    ],
  },
  {
    name: 'air first',
    preferences: [
      'dirt_air',
      'heat_on',
      'clean_yes',
      'delay_greenhouse',
      'flare_shelter',
      'exercise_yes',
      'treat_now',
      'dirt_build',
      'ice_send',
      'leak_patch',
    ],
  },
  {
    name: 'treat the sick astronaut',
    preferences: [
      'treat_now',
      'heat_on',
      'clean_yes',
      'dirt_air',
      'flare_shelter',
      'delay_greenhouse',
      'exercise_yes',
      'dirt_shield',
      'ice_send',
      'leak_patch',
    ],
  },
  {
    name: 'careless',
    preferences: [
      'dirt_build',
      'heat_off',
      'clean_skip',
      'delay_air',
      'treat_rest',
      'flare_work',
      'exercise_skip',
      'leak_ignore',
      'ice_stay',
    ],
  },
];

function expectApiError(fn: () => unknown, code: string, status: number): void {
  let thrown: unknown = null;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  expect(thrown, `expected ${code} to be thrown`).not.toBeNull();
  expect(thrown).toMatchObject({ code, status });
}

function choose(view: RoundView, preferences: string[]) {
  for (const id of preferences) {
    const offered = view.choices.find(choice => choice.id === id && !choice.disabled);
    if (offered) return offered;
  }
  const available = view.choices.find(choice => !choice.disabled);
  if (!available) throw new Error('engine deadlock: no enabled choice');
  return available;
}

const TEST_RUN_ID = 'run_replay_equal';

function playLikeClient(
  seed: number,
  difficulty: DifficultyMode,
  liveFlareBonus: number,
  preferences: string[],
  runId: string = TEST_RUN_ID
): { state: GameState; choices: RunChoiceRecord[] } {
  let state = { ...startGame(seed, difficulty, liveFlareBonus), runId };
  const choices: RunChoiceRecord[] = [];

  while (state.status === 'playing') {
    const view = getRoundView(state);
    const choice = choose(view, preferences);
    choices.push({ round: state.round, choiceId: choice.id });
    state = submitChoice(state, choice.id);
    if (choices.length > 12) throw new Error('engine did not finish after 12 rounds');
  }

  return { state, choices };
}

describe('server replay matches the client engine', () => {
  for (const strategy of STRATEGIES) {
    for (const difficulty of DIFFICULTIES) {
      for (const bonus of FLARE_BONUSES) {
        it(`${strategy.name} / ${difficulty} / flare +${bonus}`, () => {
          for (const seed of SEEDS) {
            const client = playLikeClient(seed, difficulty, bonus, strategy.preferences);
            const clientReport = buildReport(client.state);

            const server = replayRun({
              runId: TEST_RUN_ID,
              seed,
              difficulty,
              liveFlareBonus: bonus,
              choices: client.choices,
            });
            const serverReport = server.report;

            expect(server.state.status).toBe(client.state.status);
            expect(server.state.failureReason).toBe(client.state.failureReason);
            expect(server.state.round).toBe(client.state.round);
            expect(serverReport).not.toBeNull();
            expect(serverReport).toEqual(clientReport);
            expect(serverReport?.score).toBe(clientReport.score);
            expect(serverReport?.roundsSurvived).toBe(clientReport.roundsSurvived);
            expect(serverReport?.finalPower).toBe(client.state.power);
            expect(serverReport?.finalOxygen).toBe(client.state.oxygen);
            expect(serverReport?.finalHealth).toBe(client.state.health);
            expect(serverReport?.finalMoonDirt).toBe(client.state.moonDirt);
            expect(serverReport?.finalShield).toBe(client.state.shield);
          }
        });
      }
    }
  }

  it('rejects a disabled choice with illegal_choice', () => {
    let found:
      | {
          seed: number;
          difficulty: DifficultyMode;
          liveFlareBonus: number;
          previous: RunChoiceRecord[];
          round: number;
          choiceId: string;
        }
      | null = null;

    outer: for (const difficulty of DIFFICULTIES) {
      for (const bonus of FLARE_BONUSES) {
        for (const seed of SEEDS) {
          let state = startGame(seed, difficulty, bonus);
          const previous: RunChoiceRecord[] = [];
          let guard = 0;

          while (state.status === 'playing' && guard < 12) {
            const view = getRoundView(state);
            const disabled = view.choices.find(choice => choice.disabled);
            if (disabled) {
              found = {
                seed,
                difficulty,
                liveFlareBonus: bonus,
                previous: [...previous],
                round: state.round,
                choiceId: disabled.id,
              };
              break outer;
            }
            const choice = view.choices.find(candidate => !candidate.disabled);
            if (!choice) break;
            previous.push({ round: state.round, choiceId: choice.id });
            state = submitChoice(state, choice.id);
            guard += 1;
          }
        }
      }
    }

    expect(found).not.toBeNull();
    if (!found) return;

    expectApiError(
      () =>
        replayRun({
          runId: 'run_illegal_choice',
          seed: found!.seed,
          difficulty: found!.difficulty,
          liveFlareBonus: found!.liveFlareBonus,
          choices: [
            ...found!.previous,
            { round: found!.round, choiceId: found!.choiceId },
          ],
        }),
      'illegal_choice',
      422
    );
  });

  it('rejects wrong round order with round_mismatch', () => {
    expectApiError(
      () =>
        replayRun({
          runId: 'run_wrong_round',
          seed: 1,
          difficulty: 'standard',
          liveFlareBonus: 0,
          choices: [{ round: 2, choiceId: 'heat_on' }],
        }),
      'round_mismatch',
      422
    );
  });

  it('rejects choices after the run ended with choices_after_end', () => {
    const careless = STRATEGIES.find(strategy => strategy.name === 'careless');
    expect(careless).toBeDefined();
    const client = playLikeClient(1, 'commander', 0, careless!.preferences);
    expect(client.state.status).not.toBe('playing');
    expect(client.state.round).toBeLessThan(12);

    expectApiError(
      () =>
        replayRun({
          runId: 'run_after_end',
          seed: 1,
          difficulty: 'commander',
          liveFlareBonus: 0,
          choices: [
            ...client.choices,
            { round: client.state.round + 1, choiceId: 'heat_on' },
          ],
        }),
      'choices_after_end',
      422
    );
  });
});
