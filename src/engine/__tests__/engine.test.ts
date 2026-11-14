import { describe, it, expect } from 'vitest';
import { startGame, getRoundView, submitChoice, buildReport } from '../index';
import { computeFlareDamage } from '../rules';

describe('Silica Station Engine', () => {
  it('Round 1 choice fires exactly 3 rounds later (in Round 4)', () => {
    let state = startGame(1);
    expect(state.round).toBe(1);
    expect(state.moonDirt).toBe(60);

    // Round 1: pick dirt_air (-15 dirt now, +22 oxygen in Round 4)
    state = submitChoice(state, 'dirt_air');
    expect(state.moonDirt).toBe(45);
    expect(state.round).toBe(2);
    expect(state.lastResults.length).toBe(0);

    // Round 2: heating ON
    state = submitChoice(state, 'heat_on');
    expect(state.round).toBe(3);
    expect(state.lastResults.length).toBe(0);

    // Round 3: dirt_shield
    state = submitChoice(state, 'dirt_shield');
    expect(state.round).toBe(4);
    expect(state.lastResults.length).toBe(0);

    // Round 4: clean panels — Round 1 dirt_air lands here!
    state = submitChoice(state, 'clean_yes');
    expect(state.lastResults.length).toBe(1);
    expect(state.lastResults[0].sourceRound).toBe(1);
    expect(state.lastResults[0].choiceLabel).toBe('Turn moon dirt into Air');
  });

  it('computes solar flare damage with 30-shield cap and shelter halving', () => {
    expect(computeFlareDamage(0, false)).toBe(45);
    expect(computeFlareDamage(15, false)).toBe(30);
    expect(computeFlareDamage(30, false)).toBe(15);
    // Third shield pick (45) does NOT reduce beyond 30
    expect(computeFlareDamage(45, false)).toBe(15);
    // Shelter halves remaining damage
    expect(computeFlareDamage(30, true)).toBe(8);
    expect(computeFlareDamage(0, true)).toBe(23);
  });

  it('applies remaining queued items in Round 12 resupply check-up before scoring', () => {
    let state = startGame(1);
    const carefulPath = [
      'dirt_air',
      'heat_on',
      'dirt_shield',
      'clean_yes',
      'dirt_build',
      'delay_greenhouse',
      'heat_on',
      'flare_shelter',
      'heat_on',
      'clean_skip',
      'exercise_skip',
      'heat_off',
    ];

    for (const c of carefulPath) {
      state = submitChoice(state, c);
    }

    // Because R11 exercise_skip (-10 H) and R12 heat_off (-15 H) land in check-up,
    // health is lower than before R12 checkup (late choices are never free!)
    const report = buildReport(state);
    expect(report.checkupApplied.length).toBe(3);
    expect(report.finalHealth).toBeLessThan(75);
  });

  it('Headless balance: careless strategy (no air, heating off, no shelter) MUST fail early on oxygen', () => {
    let state = startGame(1);
    const carelessChoices = [
      'dirt_build',
      'heat_off',
      'dirt_build',
      'clean_skip',
      'dirt_build',
      'delay_air',
      'treat_rest',
      'flare_work',
      'heat_off',
      'clean_skip',
      'exercise_skip',
      'heat_off',
    ];

    for (const c of carelessChoices) {
      if (state.status !== 'playing') break;
      const view = getRoundView(state);
      const choice = view.choices.find(ch => ch.id === c) ?? view.choices[0];
      state = submitChoice(state, choice.id);
    }

    expect(state.status).toBe('lost');
    expect(state.failureReason).toBe('oxygen');
    expect(state.round).toBeLessThanOrEqual(8);
    const report = buildReport(state);
    expect(report.chainLines.length).toBeGreaterThan(0);
    expect(report.biggestLinkHint.short.length).toBeGreaterThan(0);
  });

  it('Headless balance: balanced careful strategy (Air + Shield + Battery + CSA Greenhouse) wins cleanly', () => {
    let state = startGame(1);
    const carefulStrategy = [
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

    for (const c of carefulStrategy) {
      expect(state.status).toBe('playing');
      state = submitChoice(state, c);
    }

    expect(state.status).toBe('won');
    expect(state.health).toBeGreaterThan(80);
    expect(state.oxygen).toBeGreaterThan(0);
    expect(state.power).toBeGreaterThan(0);
  });

  it('supports deterministic Same Scenario retries and seeded New Scenario variations', () => {
    const a = startGame(1);
    const b = startGame(1);
    expect(a.roundSchedule).toEqual(b.roundSchedule);

    // Check several seeds to confirm New Scenario produces varied round schedules deterministically
    const varied = startGame(42);
    const variedRepeat = startGame(42);
    expect(varied.roundSchedule).toEqual(variedRepeat.roundSchedule);
    expect(varied.roundSchedule).not.toEqual(a.roundSchedule);
  });

  it('supports Cadet and Commander difficulty starts and awards Mission Badges on win', () => {
    const cadet = startGame(1, 'cadet');
    const commander = startGame(1, 'commander');
    expect(cadet.power).toBeGreaterThan(commander.power);
    expect(cadet.moonDirt).toBeGreaterThan(commander.moonDirt);

    let state = startGame(1, 'standard');
    const path = [
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
    for (const c of path) {
      state = submitChoice(state, c);
    }
    const report = buildReport(state);
    expect(report.badges.length).toBeGreaterThanOrEqual(4);
    expect(report.badges.some(b => b.id === 'zero_blackout')).toBe(true);
    expect(report.badges.some(b => b.id === 'solar_steward')).toBe(true);
  });

  it('fails by oxygen depletion when player produces air only once and never again', () => {
    let state = startGame(1, 'standard');
    const oneAirOnlyPath = [
      'dirt_air',
      'heat_on',
      'dirt_shield',
      'clean_yes',
      'dirt_build',
      'delay_eat_less',
      'heat_on',
      'flare_shelter',
      'heat_on',
      'clean_yes',
      'exercise_yes',
      'heat_on',
    ];

    for (const c of oneAirOnlyPath) {
      if (state.status !== 'playing') break;
      state = submitChoice(state, c);
    }

    expect(state.status).toBe('lost');
    expect(state.failureReason).toBe('oxygen');
    expect(state.oxygen).toBe(0);
  });

  it('fails if player blindly clicks the top choice every round or neglects systems after R1 air', () => {
    // 1. Blind top-button clicking
    let spamState = startGame(1, 'standard');
    for (let r = 1; r <= 12 && spamState.status === 'playing'; r++) {
      const view = getRoundView(spamState);
      const firstAvail = view.choices.find(ch => !ch.disabled) ?? view.choices[0];
      spamState = submitChoice(spamState, firstAvail.id);
    }
    expect(spamState.status).toBe('lost');
    expect(spamState.failureReason).toBe('oxygen');

    // 2. Following R1 arrow then neglecting care
    let neglectState = startGame(1, 'standard');
    const neglectPath = [
      'dirt_air',
      'heat_off',
      'dirt_shield',
      'clean_skip',
      'dirt_shield',
      'delay_air',
      'treat_rest',
      'flare_work',
      'heat_off',
      'clean_skip',
      'exercise_skip',
      'heat_off',
    ];

    for (const c of neglectPath) {
      if (neglectState.status !== 'playing') break;
      const view = getRoundView(neglectState);
      const choice = view.choices.find(ch => ch.id === c) ?? view.choices[0];
      neglectState = submitChoice(neglectState, choice.id);
    }

    expect(neglectState.status).toBe('lost');
    expect(neglectState.failureReason).toBe('oxygen');
  });

  it('fails when poor health choices drive crew health to 0% even with sufficient oxygen', () => {
    let state = startGame(1, 'standard');
    const healthNeglectPath = [
      'dirt_air',
      'heat_off',
      'dirt_air',
      'clean_yes',
      'dirt_build',
      'delay_eat_less',
      'treat_rest',
      'flare_work',
      'heat_off',
    ];

    for (const c of healthNeglectPath) {
      if (state.status !== 'playing') break;
      const view = getRoundView(state);
      const choice = view.choices.find(ch => ch.id === c) ?? view.choices[0];
      state = submitChoice(state, choice.id);
    }

    expect(state.status).toBe('lost');
    expect(state.failureReason).toBe('health');
    expect(state.health).toBe(0);
    expect(state.oxygen).toBeGreaterThan(0);
  });
});
