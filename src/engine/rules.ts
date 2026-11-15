import { GameState, ResourceDelta } from '../types';

export const DRAFT_RULES = {
  maxRounds: 12,
  startPower: 100,
  startPowerCap: 100,
  startOxygen: 85,
  startHealth: 100,
  startMoonDirt: 20,
  flareMaxShieldCounted: 15,
};

export function applyResourceDelta(
  state: GameState,
  delta: ResourceDelta
): { nextState: GameState; flareHalfTriggered: boolean } {
  let nextState = { ...state };
  let flareHalfTriggered = false;

  if (delta.power !== undefined) {
    nextState.power = Math.max(0, Math.min(nextState.powerCap, nextState.power + delta.power));
  }

  if (delta.powerCap !== undefined) {
    nextState.powerCap += delta.powerCap;
    nextState.power = Math.min(nextState.power, nextState.powerCap);
  }

  if (delta.oxygen !== undefined) {
    nextState.oxygen = Math.max(0, Math.min(nextState.oxygenCap, nextState.oxygen + delta.oxygen));
  }

  if (delta.health !== undefined) {
    nextState.health = Math.max(0, Math.min(nextState.healthCap, nextState.health + delta.health));
  }

  if (delta.moonDirt !== undefined) {
    nextState.moonDirt = Math.max(0, nextState.moonDirt + delta.moonDirt);
  }

  if (delta.shield !== undefined) {
    nextState.shield = Math.max(0, Math.min(30, nextState.shield + delta.shield));
  }

  if (delta.sick !== undefined) {
    nextState.sick = delta.sick;
  }

  if (delta.dustPenalty !== undefined) {
    nextState.dustDebuffRounds = delta.dustPenalty;
  }

  if (delta.flareHalf !== undefined && delta.flareHalf) {
    flareHalfTriggered = true;
  }

  return { nextState, flareHalfTriggered };
}

export function applyUpkeep(
  state: GameState,
  isNight: boolean
): { nextState: GameState; summary: string; powerAtZeroPenalty: boolean } {
  let nextState = { ...state };
  let powerAtZeroPenalty = false;

  // Solar power generation
  const solarGen = isNight ? 0 : 10;
  nextState.power = Math.min(nextState.powerCap, nextState.power + solarGen);

  // Base power load
  nextState.power = Math.max(0, nextState.power - 5);

  // Crew oxygen consumption
  nextState.oxygen = Math.max(0, nextState.oxygen - 12);

  // Power at zero check
  if (nextState.power <= 0) {
    powerAtZeroPenalty = true;
    nextState.oxygen = Math.max(0, nextState.oxygen - 15);
  }

  // Dust debuff
  if (nextState.dustDebuffRounds > 0) {
    nextState.dustDebuffRounds--;
  }

  const parts: string[] = [];
  if (solarGen > 0) parts.push(`+${solarGen} solar`);
  parts.push('-5 base load');
  parts.push('-12 O2 crew');
  if (powerAtZeroPenalty) parts.push('⚠ -15 O2 (power at 0!)');

  return {
    nextState,
    summary: parts.join(', '),
    powerAtZeroPenalty,
  };
}

export function computeFlareDamage(
  shield: number,
  sheltered: boolean,
  liveBonus: number
): number {
  const baseDamage = 45;
  const shieldBlocked = Math.min(DRAFT_RULES.flareMaxShieldCounted, shield);
  const afterShield = Math.max(0, baseDamage - shieldBlocked);
  const afterShelter = sheltered ? Math.floor(afterShelter / 2) : afterShield;
  const withLiveBonus = afterShelter + Math.floor(liveBonus * 5);
  return withLiveBonus;
}