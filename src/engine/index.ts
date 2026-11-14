import {
  GameState,
  RoundView,
  TraceEntry,
  TextPair,
} from '../types';
import { generateRunId } from './rng';
import {
  enqueueChoiceConsequence,
  partitionDueConsequences,
  buildCountdownDots,
} from './queue';
import {
  DRAFT_RULES,
  applyResourceDelta,
  applyUpkeep,
  computeFlareDamage,
} from './rules';
import {
  SCENARIO,
  buildRoundSchedule,
  getRoundDefinition,
} from './events';
import { buildReport } from './report';

export { buildReport };

export function startGame(
  seed: number = 1,
  difficulty: 'cadet' | 'standard' | 'commander' = 'standard',
  liveFlareBonus: number = 0
): GameState {
  const startPower =
    difficulty === 'cadet'
      ? DRAFT_RULES.startPower + 15
      : difficulty === 'commander'
      ? DRAFT_RULES.startPower - 10
      : DRAFT_RULES.startPower;

  const startMoonDirt =
    difficulty === 'cadet'
      ? DRAFT_RULES.startMoonDirt + 15
      : difficulty === 'commander'
      ? DRAFT_RULES.startMoonDirt - 5
      : DRAFT_RULES.startMoonDirt;

  return {
    runId: generateRunId(seed),
    seed,
    difficulty,
    round: 1,
    maxRounds: DRAFT_RULES.maxRounds,
    power: startPower,
    powerCap: DRAFT_RULES.startPowerCap,
    oxygen: DRAFT_RULES.startOxygen,
    oxygenCap: DRAFT_RULES.startOxygen,
    health: DRAFT_RULES.startHealth,
    healthCap: DRAFT_RULES.startHealth,
    moonDirt: startMoonDirt,
    shield: 0,
    sick: false,
    dustDebuffRounds: 0,
    queue: [],
    trace: [],
    lastResults: [],
    scheduledEventMessage: null,
    upkeepSummary: null,
    status: 'playing',
    failureReason: null,
    roundSchedule: buildRoundSchedule(seed),
    liveFlareBonus,
  };
}

export function getRoundView(state: GameState): RoundView {
  const def = getRoundDefinition(state);
  const isNight = def.sky === 'night' || def.sky === 'flare';

  const choices = def.choices.map(choice => {
    const dirtCost = Math.abs(Math.min(0, choice.immediate.moonDirt ?? 0));
    const powerCost = Math.abs(Math.min(0, choice.immediate.power ?? 0));

    let disabled = false;
    let disabledReason: string | undefined;

    if (dirtCost > 0 && state.moonDirt < dirtCost) {
      disabled = true;
      disabledReason = `Need ${dirtCost} moon dirt`;
    } else if (powerCost > 0 && state.power < powerCost) {
      // Allow emergency fallback ONLY if ALL choices would be disabled, otherwise lock unaffordable power spends
      disabled = true;
      disabledReason = `Need ${powerCost} power`;
    }

    return {
      ...choice,
      disabled,
      disabledReason,
    };
  });

  // Safety guarantee: never deadlock the player with all buttons disabled
  if (choices.every(c => c.disabled) && choices.length > 0) {
    const freeIdx = choices.findIndex(
      c => (c.immediate.power ?? 0) >= 0 && (c.immediate.moonDirt ?? 0) >= 0
    );
    const unlockIdx = freeIdx >= 0 ? freeIdx : choices.length - 1;
    choices[unlockIdx] = {
      ...choices[unlockIdx],
      disabled: false,
      disabledReason: undefined,
    };
  }

  return {
    round: state.round,
    maxRounds: state.maxRounds,
    chapter: def.chapter,
    chapterTitle: def.chapterTitle,
    sky: def.sky,
    isNight,
    title: def.title,
    situation: def.situation,
    warning: def.warning ?? null,
    choices,
    showTutorialArrow: Boolean(def.isTutorialArrow),
    countdownDots: buildCountdownDots(state.queue, state.round),
    lastResults: state.lastResults,
    scheduledEventMessage: state.scheduledEventMessage,
    upkeepSummary: state.upkeepSummary,
  };
}

export function submitChoice(state: GameState, choiceId: string): GameState {
  if (state.status !== 'playing') return state;

  const def = getRoundDefinition(state);
  const choice = def.choices.find(c => c.id === choiceId);
  if (!choice) return state;

  let working: GameState = { ...state };
  const currentRound = working.round;

  // 1. Apply immediate player choice + enqueue delayed consequence for round + 3
  const immRes = applyResourceDelta(working, choice.immediate);
  working = immRes.nextState;
  const shelteredThisRound = Boolean(immRes.flareHalfTriggered);

  if (choice.id === 'clean_skip') {
    working.dustDebuffRounds = 4;
  } else if (choice.id === 'clean_yes') {
    working.dustDebuffRounds = 0;
  }

  working = {
    ...working,
    queue: enqueueChoiceConsequence(working.queue, currentRound, choice),
  };

  // 2. Apply queued consequences due on currentRound (in queue order)
  const { due, remaining } = partitionDueConsequences(working.queue, currentRound);
  working = { ...working, queue: remaining };

  const landedResults: GameState['lastResults'] = [];
  for (const item of due) {
    const applied = applyResourceDelta(working, item.delta);
    working = applied.nextState;
    landedResults.push({
      sourceRound: item.sourceRound,
      choiceLabel: item.choiceLabel,
      icon: item.icon,
      reason: item.reason,
      delta: item.delta,
    });
  }

  // 3. Scheduled events on currentRound
  let scheduledEventMessage: TextPair | null = null;
  const slot = working.roundSchedule.find(s => s.round === currentRound);
  if (slot?.eventType === 'solar_flare') {
    const liveBonus = working.liveFlareBonus ?? 0;
    const dmg = computeFlareDamage(working.shield, shelteredThisRound, liveBonus);
    working = applyResourceDelta(working, { health: -dmg }).nextState;
    scheduledEventMessage = {
      short: `${SCENARIO.scheduledOutcomes.flareHit.short} (-${dmg} health)`,
      detail: `${SCENARIO.scheduledOutcomes.flareHit.detail}${liveBonus > 0 ? ` Live NASA DONKI solar activity added +${liveBonus} storm strength.` : ''} Shield blocked ${Math.min(DRAFT_RULES.flareMaxShieldCounted, working.shield)} damage${shelteredThisRound ? ', and shelter cut the rest in half' : ''}.`,
    };
  }

  // 4. Upkeep (solar, base load, crew oxygen, power-at-0 rule)
  const isNight = def.sky === 'night' || def.sky === 'flare';
  const upkeep = applyUpkeep(working, isNight);
  working = upkeep.nextState;
  if (upkeep.powerAtZeroPenalty && !scheduledEventMessage) {
    scheduledEventMessage = SCENARIO.scheduledOutcomes.powerZeroPenalty;
  }

  // Record trace entry for this round
  const traceEntry: TraceEntry = {
    round: currentRound,
    stageTitle: def.title.short,
    choiceId: choice.id,
    choiceLabel: choice.label.short,
    icon: choice.icon,
    costLabel: choice.costLabel,
    immediateApplied: choice.immediate,
    delayedScheduled: choice.delayed,
    delayedReason: choice.delayedReason.short,
    consequencesLanded: landedResults,
    scheduledEventNote: scheduledEventMessage?.short,
    endPower: working.power,
    endOxygen: working.oxygen,
    endHealth: working.health,
    endMoonDirt: working.moonDirt,
  };

  working = {
    ...working,
    trace: [...working.trace, traceEntry],
    lastResults: landedResults,
    scheduledEventMessage,
    upkeepSummary: upkeep.summary,
  };

  // 5. Fail Check
  if (working.oxygen <= 0 || working.health <= 0) {
    return {
      ...working,
      status: 'lost',
      failureReason: working.oxygen <= 0 ? 'oxygen' : 'health',
    };
  }

  // 6. End of Round 12 -> Resupply Check-Up!
  if (currentRound >= working.maxRounds) {
    const checkupResults: GameState['lastResults'] = [];
    // Apply all remaining queued consequences (rounds 10, 11, 12) in order
    const sortedRemaining = [...working.queue].sort((a, b) => a.dueRound - b.dueRound);
    for (const item of sortedRemaining) {
      const applied = applyResourceDelta(working, item.delta);
      working = applied.nextState;
      checkupResults.push({
        sourceRound: item.sourceRound,
        choiceLabel: item.choiceLabel,
        icon: item.icon,
        reason: item.reason,
        delta: item.delta,
      });
    }

    working = {
      ...working,
      queue: [],
      lastResults: [...landedResults, ...checkupResults],
      scheduledEventMessage: SCENARIO.scheduledOutcomes.resupplyArrived,
    };

    if (working.oxygen <= 0 || working.health < 50) {
      return {
        ...working,
        status: 'lost',
        failureReason: working.oxygen <= 0 ? 'oxygen' : 'health',
      };
    }

    const isPartial = working.health < 65;
    return {
      ...working,
      status: isPartial ? 'partial' : 'won',
      failureReason: null,
    };
  }

  // Advance to next round
  return {
    ...working,
    round: currentRound + 1,
  };
}
