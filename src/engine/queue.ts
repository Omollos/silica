import { QueuedConsequence, ChoiceDefinition } from '../types';

export const DELAY_ROUNDS = 3;

export function enqueueChoiceConsequence(
  queue: QueuedConsequence[],
  currentRound: number,
  choice: ChoiceDefinition
): QueuedConsequence[] {
  const item: QueuedConsequence = {
    id: `q_${currentRound}_${choice.id}_${queue.length}`,
    sourceRound: currentRound,
    dueRound: currentRound + DELAY_ROUNDS,
    choiceId: choice.id,
    choiceLabel: choice.label.short,
    icon: choice.icon,
    delta: choice.delayed,
    reason: choice.delayedReason,
  };
  return [...queue, item];
}

export function partitionDueConsequences(
  queue: QueuedConsequence[],
  round: number
): { due: QueuedConsequence[]; remaining: QueuedConsequence[] } {
  const due: QueuedConsequence[] = [];
  const remaining: QueuedConsequence[] = [];
  for (const item of queue) {
    if (item.dueRound <= round) {
      due.push(item);
    } else {
      remaining.push(item);
    }
  }
  return { due, remaining };
}

export function buildCountdownDots(
  queue: QueuedConsequence[],
  currentRound: number
): { roundsAway: 1 | 2 | 3; items: QueuedConsequence[] }[] {
  return ([1, 2, 3] as const).map(offset => ({
    roundsAway: offset,
    items: queue.filter(q => q.dueRound === currentRound + offset),
  }));
}
