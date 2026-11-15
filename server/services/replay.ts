import { buildReport, getRoundView, startGame, submitChoice } from '../../src/engine';
import type { DifficultyMode, GameState, MissionReport } from '../../src/types';
import type { RunChoiceRecord } from '../db/store';
import { ApiError } from '../errors';

export interface ReplayInput {
  /** Client-supplied run id from the URL; the only non-deterministic engine field. */
  runId: string;
  seed: number;
  difficulty: DifficultyMode;
  liveFlareBonus: number;
  choices: RunChoiceRecord[];
}

export interface ReplayOutcome {
  state: GameState;
  report: MissionReport | null;
  choices: RunChoiceRecord[];
}

/**
 * Replays a run with the exact engine the browser uses. The client never
 * supplies results: status, meters, score and the Mission Report all come from
 * this function.
 *
 * The engine's submitChoice silently ignores unknown choices and accepts
 * disabled ones, so every choice is gated against getRoundView first.
 */
export function replayRun(input: ReplayInput): ReplayOutcome {
  const ordered = [...input.choices].sort((a, b) => a.round - b.round);
  const seenRounds = new Set<number>();
  for (const choice of ordered) {
    if (seenRounds.has(choice.round)) {
      throw new ApiError(400, 'invalid_body', 'Each round may contain only one choice.');
    }
    seenRounds.add(choice.round);
  }

  // startGame generates its own runId from Date.now(); replace it with the
  // validated id from the URL so the stored MissionReport matches the client.
  let state = { ...startGame(input.seed, input.difficulty, input.liveFlareBonus), runId: input.runId };

  for (const choice of ordered) {
    if (state.status !== 'playing') {
      throw new ApiError(422, 'choices_after_end', 'This run has already finished.');
    }
    if (choice.round !== state.round) {
      throw new ApiError(
        422,
        'round_mismatch',
        `Expected round ${state.round} but received round ${choice.round}.`
      );
    }

    const view = getRoundView(state);
    const offered = view.choices.find(candidate => candidate.id === choice.choiceId);
    if (!offered) {
      throw new ApiError(422, 'unknown_choice', 'That choice is not part of this round.');
    }
    if (offered.disabled) {
      throw new ApiError(422, 'illegal_choice', offered.disabledReason ?? 'That choice is not available.');
    }

    state = submitChoice(state, choice.choiceId);
  }

  const report = state.status === 'playing' ? null : buildReport(state);
  return { state, report, choices: ordered };
}
