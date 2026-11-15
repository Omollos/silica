import { RoundDefinition, RoundScheduleSlot, ScenarioData, TextPair } from '../types';

export const SCENARIO: ScenarioData = {
  meta: {
    title: 'Silica Station',
    subtitle: {
      short: 'A Moon Mission Survival Game',
      detail: 'Command a lunar outpost and make critical decisions to keep your crew alive.',
    },
    location: {
      short: 'Mare Tranquillitatis, Moon',
      detail: 'The Sea of Tranquility, where Apollo 11 landed.',
    },
    moonDirtNote: {
      short: 'Moon dirt (regolith) is your primary resource for building and repairs.',
      detail: 'Lunar regolith can be used to build shields, generate oxygen, and repair equipment.',
    },
    powerAtZeroRule: {
      short: 'If power reaches 0, oxygen scrubbers shut down and crew health drops rapidly.',
      detail: 'Always maintain backup power or reduce consumption to avoid catastrophic failure.',
    },
    darkPeriodNote: 'The lunar night lasts 14 Earth days and solar panels generate no power.',
  },
  chapters: [
    { id: 1, title: 'Arrival', rounds: '1-3', summary: 'Establish basic life support' },
    { id: 2, title: 'Challenges', rounds: '4-8', summary: 'Face environmental hazards' },
    { id: 3, title: 'Survival', rounds: '9-12', summary: 'Prepare for resupply' },
  ],
  warnings: {
    night_soon: {
      short: 'Night is coming! Solar power will stop.',
      detail: 'Prepare batteries and reduce power consumption before the 14-day lunar night begins.',
    },
    delay_soon: {
      short: 'Resupply rocket delayed!',
      detail: 'The resupply ship is running behind schedule. Conserve resources carefully.',
    },
    flare_soon: {
      short: 'Solar flare detected!',
      detail: 'A dangerous solar flare is approaching. Build shields and shelter the crew.',
    },
    leak_soon: {
      short: 'Air leak detected!',
      detail: 'A micrometeorite has punctured the hull. Patch it quickly before oxygen runs out.',
    },
  },
  events: {
    moon_dirt_1: {
      title: { short: 'Moon Dirt Available', detail: 'Collect regolith for building materials.' },
      situation: {
        short: 'Your crew has found a deposit of fine lunar regolith.',
        detail: 'This moon dirt can be processed into building materials, radiation shielding, and oxygen.',
      },
      choices: [
        {
          id: 'collect_dirt_1',
          icon: 'dirt',
          label: { short: 'Collect Regolith', detail: 'Send a rover to collect moon dirt.' },
          costLabel: '-10 power',
          why: {
            short: 'Gathers raw materials for future construction.',
            detail: 'Regolith is essential for building shields and generating oxygen.',
          },
          immediate: { power: -10, moonDirt: 20 },
          delayed: { shield: 5 },
          delayedReason: {
            short: 'Regolith processed into shield material.',
            detail: 'The collected dirt is processed and added to your radiation shielding.',
          },
        },
      ],
    },
  },
  scheduledOutcomes: {
    flareHit: {
      short: 'Solar flare hits the station!',
      detail: 'Radiation damages the crew and equipment.',
    },
    resupplyArrived: {
      short: 'Resupply rocket docked successfully!',
      detail: 'Fresh supplies and new crew members have arrived.',
    },
    powerZeroPenalty: {
      short: 'Power at zero! Emergency protocols engaged.',
      detail: 'Life support systems are running on backup power. Crew health is at risk.',
    },
  },
};

export function buildRoundSchedule(seed: number): RoundScheduleSlot[] {
  const schedule: RoundScheduleSlot[] = [
    { round: 1, eventType: 'moon_dirt_1', sky: 'day' },
    { round: 2, eventType: 'heating', sky: 'day' },
    { round: 3, eventType: 'moon_dirt_2', sky: 'day' },
    { round: 4, eventType: 'clean_panels', sky: 'day' },
    { round: 5, eventType: 'moon_dirt_3', sky: 'dawn' },
    { round: 6, eventType: 'supply_delay', sky: 'day' },
    { round: 7, eventType: 'heating_or_treat', sky: 'day' },
    { round: 8, eventType: 'solar_flare', sky: 'flare', warningKey: 'flare_soon' },
    { round: 9, eventType: 'exercise', sky: 'night' },
    { round: 10, eventType: 'dig_ice', sky: 'night' },
    { round: 11, eventType: 'air_leak', sky: 'night', warningKey: 'leak_soon' },
    { round: 12, eventType: 'air_leak', sky: 'resupply' },
  ];

  return schedule;
}

export function getRoundDefinition(state: any): RoundDefinition {
  const slot = state.roundSchedule.find((s: any) => s.round === state.round);
  if (!slot) {
    return {
      round: state.round,
      chapter: 1,
      chapterTitle: 'Arrival',
      title: { short: 'Mission Day ' + state.round, detail: 'Continue your mission.' },
      situation: { short: 'The station is operating normally.', detail: 'Make decisions to keep the crew alive.' },
      sky: 'day',
      choices: [],
    };
  }

  const event = SCENARIO.events[slot.eventType];
  if (!event) {
    return {
      round: state.round,
      chapter: 1,
      chapterTitle: 'Arrival',
      title: { short: 'Mission Day ' + state.round, detail: 'Continue your mission.' },
      situation: { short: 'The station is operating normally.', detail: 'Make decisions to keep the crew alive.' },
      sky: slot.sky,
      choices: [],
    };
  }

  return {
    round: state.round,
    chapter: Math.ceil(state.round / 4),
    chapterTitle: SCENARIO.chapters[Math.ceil(state.round / 4) - 1]?.title || 'Arrival',
    title: event.title,
    situation: event.situation,
    sky: slot.sky,
    warning: slot.warningKey ? SCENARIO.warnings[slot.warningKey] : undefined,
    choices: event.choices,
    isTutorialArrow: state.round === 1,
  };
}