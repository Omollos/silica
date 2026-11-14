import scenarioJson from '../content/scenario.json';
import {
  ChoiceDefinition,
  RoundDefinition,
  RoundScheduleSlot,
  ScenarioData,
  GameState,
} from '../types';
import { createRng } from './rng';

export const SCENARIO = scenarioJson as unknown as ScenarioData;

export const CLASSIC_SCHEDULE: RoundScheduleSlot[] = [
  { round: 1, eventType: 'moon_dirt_1', sky: 'day' },
  { round: 2, eventType: 'heating', sky: 'day' },
  { round: 3, eventType: 'moon_dirt_2', sky: 'day', warningKey: 'night_soon' },
  { round: 4, eventType: 'clean_panels', sky: 'day', warningKey: 'delay_soon' },
  { round: 5, eventType: 'moon_dirt_3', sky: 'night' },
  { round: 6, eventType: 'supply_delay', sky: 'night', warningKey: 'flare_soon' },
  { round: 7, eventType: 'heating_or_treat', sky: 'night' },
  { round: 8, eventType: 'solar_flare', sky: 'flare' },
  { round: 9, eventType: 'heating', sky: 'night' },
  { round: 10, eventType: 'clean_panels', sky: 'dawn' },
  { round: 11, eventType: 'exercise', sky: 'day' },
  { round: 12, eventType: 'heating', sky: 'resupply' },
];

export function buildRoundSchedule(seed: number): RoundScheduleSlot[] {
  // Seed 1 uses the exact canonical 12-stage Build Plan sequence
  if (seed === 1) {
    return CLASSIC_SCHEDULE.map(slot => ({ ...slot }));
  }

  const rng = createRng(seed);
  const schedule = CLASSIC_SCHEDULE.map(slot => ({ ...slot }));

  // In varied scenarios ("Wild Crater Run"), introduce stretch hazards cleanly
  // while keeping Moon Dirt picks (1, 3, 5), Night (5-9), Delay (6), Flare (8), and Resupply (12) balanced.
  const useLeakRound9 = rng() > 0.45;
  const swapRound11 = rng() > 0.45;

  if (useLeakRound9) {
    schedule[8] = { round: 9, eventType: 'air_leak', sky: 'night' };
    schedule[6] = {
      ...schedule[6],
      warningKey: 'leak_soon',
    };
  } else {
    schedule[8] = { round: 9, eventType: 'dig_ice', sky: 'night' };
  }

  if (swapRound11) {
    schedule[10] = { round: 11, eventType: 'dig_ice', sky: 'day' };
  }

  return schedule;
}

export function getChapterForRound(round: number): { id: number; title: string } {
  if (round <= 3) return { id: 1, title: SCENARIO.chapters[0].title };
  if (round <= 6) return { id: 2, title: SCENARIO.chapters[1].title };
  if (round <= 9) return { id: 3, title: SCENARIO.chapters[2].title };
  return { id: 4, title: SCENARIO.chapters[3].title };
}

export function getRoundDefinition(state: GameState): RoundDefinition {
  const slot =
    state.roundSchedule.find(s => s.round === state.round) ??
    CLASSIC_SCHEDULE[Math.min(state.round - 1, CLASSIC_SCHEDULE.length - 1)];

  const chapter = getChapterForRound(state.round);
  const warning = slot.warningKey ? SCENARIO.warnings[slot.warningKey] : undefined;

  let eventKey: keyof typeof SCENARIO.events = 'heating';
  if (
    slot.eventType === 'moon_dirt_1' ||
    slot.eventType === 'moon_dirt_2' ||
    slot.eventType === 'moon_dirt_3'
  ) {
    eventKey = 'moon_dirt';
  } else if (slot.eventType === 'heating_or_treat') {
    eventKey = state.sick ? 'treat_sick' : 'heating';
  } else {
    eventKey = slot.eventType;
  }

  const rawEvent = SCENARIO.events[eventKey];
  const choices: ChoiceDefinition[] = rawEvent.choices.map(c => ({ ...c }));

  return {
    round: state.round,
    chapter: chapter.id,
    chapterTitle: chapter.title,
    title: rawEvent.title,
    situation: rawEvent.situation,
    sky: slot.sky,
    warning,
    choices,
    isTutorialArrow: state.round === 1,
  };
}
