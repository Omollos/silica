import { GameState, MissionReport, ReportChainLink, TextPair } from '../types';

export function buildReport(state: GameState): MissionReport {
  const chainLinks: ReportChainLink[] = [];

  for (const entry of state.trace) {
    let impactScore = 0;
    let conseqShort = 'Kept station steady.';
    let detail = `In Round ${entry.round}, you chose "${entry.choiceLabel}".`;

    // Check delayed penalties or gains
    const d = entry.delayedScheduled;
    const imm = entry.immediateApplied;

    if ((d.health ?? 0) < 0 || (d.oxygen ?? 0) < 0 || (d.power ?? 0) < 0) {
      impactScore += Math.abs(d.health ?? 0) * 2 + Math.abs(d.oxygen ?? 0) * 1.5 + Math.abs(d.power ?? 0);
      conseqShort = entry.delayedReason;
      detail = `In Round ${entry.round}, "${entry.choiceLabel}" caused ${entry.delayedReason} three rounds later.`;
    } else if (entry.choiceId === 'flare_work') {
      impactScore += 35;
      conseqShort = 'Took full solar flare radiation damage.';
      detail = `In Round ${entry.round}, keeping the crew working during the solar flare caused full radiation damage and later fatigue.`;
    } else if ((d.oxygen ?? 0) > 0 || (d.shield ?? 0) > 0 || (d.power ?? 0) > 0) {
      impactScore += 12;
      conseqShort = entry.delayedReason;
      detail = `In Round ${entry.round}, "${entry.choiceLabel}" paid off three rounds later: ${entry.delayedReason}`;
    }

    if ((imm.power ?? 0) < 0 || (imm.moonDirt ?? 0) < 0) {
      impactScore += 5;
    }

    chainLinks.push({
      round: entry.round,
      icon: entry.icon,
      actionShort: entry.choiceLabel,
      costShort: entry.costLabel,
      consequenceShort: conseqShort,
      detail,
      impactScore,
    });
  }

  // Sort by highest impact so the Black Box highlights the 3 biggest causal links in chronological order
  const topThree = [...chainLinks]
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 3)
    .sort((a, b) => a.round - b.round);

  // Summarize total resources sacrificed
  let dirtSpent = 0;
  let powerSpent = 0;
  for (const entry of state.trace) {
    if ((entry.immediateApplied.moonDirt ?? 0) < 0) {
      dirtSpent += Math.abs(entry.immediateApplied.moonDirt ?? 0);
    }
    if ((entry.immediateApplied.power ?? 0) < 0) {
      powerSpent += Math.abs(entry.immediateApplied.power ?? 0);
    }
  }

  const sacrificedSummary: string[] = [
    `${dirtSpent} moon dirt used across oxygen, shielding, and repairs`,
    `${powerSpent} power spent on heating, shelter, cleaning, and medical care`,
  ];

  let biggestLinkHint: TextPair;
  if (state.status === 'lost') {
    if (state.failureReason === 'oxygen') {
      const madeAirCount = state.trace.filter(
        t => t.choiceId === 'dirt_air' || t.choiceId === 'delay_greenhouse' || t.choiceId === 'ice_send'
      ).length;
      if (madeAirCount < 2) {
        biggestLinkHint = {
          short: 'Hint: Make Air twice—for example Moon Dirt Air plus CSA Lunar Greenhouse!',
          detail:
            'You start with 85 oxygen, and 12 rounds burn 144 oxygen. One Air batch alone leaves you short by Round 10—combine Moon Dirt Air with CSA Greenhouse greens or a second Air batch.',
        };
      } else if (state.trace.some(t => t.endPower === 0)) {
        biggestLinkHint = {
          short: 'Hint: Never let Power hit 0—air machines stop and oxygen drops by -15 extra!',
          detail:
            'When battery power hits 0, oxygen scrubbers shut off and oxygen drops by an extra 15 each round. Clean solar panels or build a Battery Box before night starts.',
        };
      } else {
        biggestLinkHint = {
          short: 'Hint: Protect oxygen during the supply delay, stay warm, and avoid air leaks.',
          detail:
            'Cold cabin pipes, untreated sickness, unpatched leaks, and tapping emergency air in Round 6 quickly drain your oxygen tanks to 0.',
        };
      }
    } else {
      // Health failure
      const skippedHeating = state.trace.some(t => t.choiceId === 'heat_off');
      const lowShield = state.shield < 15;
      if (lowShield && state.trace.some(t => t.choiceId === 'flare_work')) {
        biggestLinkHint = {
          short: 'Hint: Stack moon dirt as a Shield and take Shelter in Round 8.',
          detail:
            'Without moon dirt shielding or shelter, the Round 8 solar flare hits for 45 crew health immediately plus delayed radiation sickness! Build Shield in Round 3 or 5 and shelter the crew.',
        };
      } else if (skippedHeating) {
        biggestLinkHint = {
          short: 'Hint: Keep Heating ON—untreated cold sickness drains crew health every round.',
          detail:
            'Switching heating OFF saves 15 power right away, but chills the crew (-18 health) and drains -5 health and -6 oxygen every round until treated!',
        };
      } else {
        biggestLinkHint = {
          short: 'Hint: Balance heating, food, shelter, and exercise so crew health stays above 0.',
          detail:
            'Health penalties from cold, hunger, skipped exercise, and radiation stack up fast. Keep heating on and shield against the solar flare.',
        };
      }
    }
  } else if (state.status === 'partial') {
    biggestLinkHint = {
      short: 'Crew survived with low reserves! Try shielding earlier or keeping heating ON.',
      detail:
        'You reached the resupply ship, though late health or oxygen drops hurt your final score. Aim to stack 2 Shields (30 max) and 1 Air pick early.',
    };
  } else {
    biggestLinkHint = {
      short: 'Great command! You balanced immediate costs against 3-round consequences.',
      detail:
        'Every Moon mission is about thinking 3 rounds ahead. Your crew arrived at the resupply rocket healthy and ready for the next expedition.',
    };
  }

  const checkupApplied = state.lastResults.filter(r => r.sourceRound >= 10);

  const badges: MissionReport['badges'] = [];
  if (state.status !== 'lost') {
    if (!state.trace.some(t => t.endPower === 0)) {
      badges.push({
        id: 'zero_blackout',
        title: 'Zero Blackout',
        description: 'Never let station battery power hit 0.',
        icon: 'power',
      });
    }
    if (state.shield >= 30) {
      badges.push({
        id: 'shield_architect',
        title: 'Shield Architect',
        description: 'Built the full 30-point regolith radiation roof.',
        icon: 'shield',
      });
    }
    if (
      state.trace.some(t => t.choiceId === 'clean_yes') &&
      !state.trace.some(t => t.choiceId === 'clean_skip')
    ) {
      badges.push({
        id: 'solar_steward',
        title: 'Solar Steward',
        description: 'Kept solar arrays brushed clean of lunar dust.',
        icon: 'clean',
      });
    }
    if (state.trace.some(t => t.choiceId === 'flare_shelter')) {
      badges.push({
        id: 'storm_commander',
        title: 'Storm Commander',
        description: 'Sheltered the crew safely through the solar flare.',
        icon: 'shelter',
      });
    }
    if (
      !state.trace.some(t => t.choiceId === 'heat_off') &&
      state.trace.some(t => t.choiceId === 'exercise_yes')
    ) {
      badges.push({
        id: 'crew_caretaker',
        title: 'Crew Caretaker',
        description: 'Kept cabin heat on and ran daily low-gravity workouts.',
        icon: 'health',
      });
    }
    if (state.powerCap > 100) {
      badges.push({
        id: 'master_builder',
        title: 'Master Builder',
        description: 'Expanded station storage with a new Moon-Dirt Battery Box.',
        icon: 'build',
      });
    }
  }

  return {
    runId: state.runId,
    seed: state.seed,
    outcome: state.status === 'playing' ? 'won' : state.status,
    failureReason: state.failureReason,
    roundsSurvived: state.status === 'lost' ? state.round : state.maxRounds,
    finalPower: state.power,
    finalOxygen: state.oxygen,
    finalHealth: state.health,
    finalMoonDirt: state.moonDirt,
    finalShield: state.shield,
    score: state.status === 'lost' ? 0 : state.health,
    chainLines: topThree,
    sacrificedSummary,
    biggestLinkHint,
    checkupApplied,
    badges,
  };
}
