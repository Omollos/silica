import { GameState, ResourceDelta } from '../types';
import { DRAFT_RULES } from './rules';

export interface QueueItem {
  id: string;
  sourceRound: number;
  dueRound: number;
  choiceId: string;
  choiceLabel: string;
  icon: any;
  delta: ResourceDelta;
  reason: any;
}

export function enqueueChoiceConsequence(
  queue: QueueItem[],
  currentRound: number,
  choice: any
): QueueItem[] {
  const dueRound = currentRound + 3;
  const id = `${choice.id}-${currentRound}-${Date.now()}`;
  return [
    ...queue,
    {
      id,
      sourceRound: currentRound,
      dueRound,
      choiceId: choice.id,
      choiceLabel: choice.label.short,
      icon: choice.icon,
      delta: choice.delayed,
      reason: choice.delayedReason,
    },
  ];
}

export function partitionDueConsequences(
  queue: QueueItem[],
  currentRound: number
): { due: QueueItem[]; remaining: QueueItem[] } {
  const due = queue.filter(item => item.dueRound <= currentRound);
  const remaining = queue.filter(item => item.dueRound > currentRound);
  return { due, remaining };
}

export function buildCountdownDots(
  queue: QueueItem[],
  currentRound: number
): { roundsAway: 1 | 2 | 3; items: QueueItem[] }[] {
  const dots: { roundsAway: 1 | 2 | 3; items: QueueItem[] }[] = [];
  for (let i = 1; i <= 3; i++) {
    const items = queue.filter(item => item.dueRound === currentRound + i);
    if (items.length > 0) {
      dots.push({ roundsAway: i as 1 | 2 | 3, items });
    }
  }
  return dots;
}