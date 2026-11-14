import { GameState, ResourceDelta } from '../types';

export const DRAFT_RULES = {
  startPower: 70,
  startPowerCap: 100,
  startOxygen: 85,
  startHealth: 100,
  startMoonDirt: 60,
  solarDayGain: 30,
  solarNightGain: 0,
  baseLoadDay: -20,
  baseLoadNight: -6,
  oxygenPerRound: -12,
  powerZeroExtraOxygenPenalty: -15,
  flareBaseDamage: 45,
  flareMaxShieldCounted: 30,
  maxRounds: 12,
};

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function applyResourceDelta(
  state: GameState,
  delta: ResourceDelta
): { nextState: GameState; flareHalfTriggered?: boolean } {
  const nextPowerCap = state.powerCap + (delta.powerCap ?? 0);
  const nextPower = clamp(state.power + (delta.power ?? 0), 0, nextPowerCap);
  const nextOxygen = clamp(state.oxygen + (delta.oxygen ?? 0), 0, state.oxygenCap);
  const nextHealth = clamp(state.health + (delta.health ?? 0), 0, state.healthCap);
  const nextDirt = Math.max(0, state.moonDirt + (delta.moonDirt ?? 0));
  const nextShield = Math.max(0, state.shield + (delta.shield ?? 0));
  const nextSick = delta.sick !== undefined ? delta.sick : state.sick;

  return {
    nextState: {
      ...state,
      powerCap: nextPowerCap,
      power: nextPower,
      oxygen: nextOxygen,
      health: nextHealth,
      moonDirt: nextDirt,
      shield: nextShield,
      sick: nextSick,
    },
    flareHalfTriggered: delta.flareHalf,
  };
}

export function computeFlareDamage(
  shield: number,
  sheltered: boolean,
  liveBonus: number = 0
): number {
  const effectiveShield = Math.min(DRAFT_RULES.flareMaxShieldCounted, shield);
  const raw = Math.max(0, DRAFT_RULES.flareBaseDamage + liveBonus - effectiveShield);
  return sheltered ? Math.ceil(raw / 2) : raw;
}

export function applyUpkeep(
  state: GameState,
  isNight: boolean
): { nextState: GameState; summary: string; powerAtZeroPenalty: boolean } {
  const baseSolar = isNight ? DRAFT_RULES.solarNightGain : DRAFT_RULES.solarDayGain;
  const dustySolarPenalty = !isNight && state.dustDebuffRounds > 0 ? -10 : 0;
  const solar = Math.max(0, baseSolar + dustySolarPenalty);
  const baseLoad = isNight ? DRAFT_RULES.baseLoadNight : DRAFT_RULES.baseLoadDay;
  const netPowerDelta = solar + baseLoad;

  let power = clamp(state.power + netPowerDelta, 0, state.powerCap);
  let oxygenDelta = DRAFT_RULES.oxygenPerRound;
  let powerAtZeroPenalty = false;

  if (power <= 0) {
    oxygenDelta += DRAFT_RULES.powerZeroExtraOxygenPenalty;
    powerAtZeroPenalty = true;
  }

  let healthDelta = 0;
  if (state.sick) {
    oxygenDelta -= 6;
    healthDelta -= 5;
  }

  const oxygen = clamp(state.oxygen + oxygenDelta, 0, state.oxygenCap);
  const health = clamp(state.health + healthDelta, 0, state.healthCap);
  const nextDustRounds = !isNight && state.dustDebuffRounds > 0
    ? state.dustDebuffRounds - 1
    : state.dustDebuffRounds;

  const dustNote = dustySolarPenalty < 0 ? ' (dusty solar!)' : '';
  const sickNote = state.sick ? ' (sick crew -5 health, -6 O2 drain!)' : '';
  const summary = isNight
    ? `Night upkeep: ${baseLoad} power, ${oxygenDelta} oxygen${healthDelta < 0 ? `, ${healthDelta} health` : ''}${powerAtZeroPenalty ? ' (Power at 0 penalty!)' : ''}${sickNote}`
    : `Day upkeep: +${solar} solar${dustNote}, ${baseLoad} load (${netPowerDelta >= 0 ? '+' : ''}${netPowerDelta} power), ${oxygenDelta} oxygen${healthDelta < 0 ? `, ${healthDelta} health` : ''}${powerAtZeroPenalty ? ' (Power at 0 penalty!)' : ''}${sickNote}`;

  return {
    nextState: {
      ...state,
      power,
      oxygen,
      health,
      dustDebuffRounds: nextDustRounds,
    },
    summary,
    powerAtZeroPenalty,
  };
}
