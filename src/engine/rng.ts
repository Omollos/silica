import { GameState } from '../types';

export function generateRunId(seed: number): string {
  const base = Date.now().toString(36);
  const rand = Math.floor(seed * 1000).toString(36);
  return `run-${base}-${rand}`;
}