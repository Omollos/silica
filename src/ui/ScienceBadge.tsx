import React from 'react';
import { StationIcon } from './icons';
import { badgeLabel } from '../shared/nasa/kidText';
import type { IconName } from '../types';

interface ScienceBadgeProps {
  kind: 'live' | 'recorded' | 'offline';
  date?: string | null;
}

const TONE: Record<ScienceBadgeProps['kind'], { icon: IconName; className: string }> = {
  live: {
    icon: 'check',
    className: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/45',
  },
  recorded: {
    icon: 'moon',
    className: 'bg-sky-500/15 text-sky-200 border-sky-400/45',
  },
  offline: {
    icon: 'build',
    className: 'bg-slate-800 text-slate-300 border-slate-600',
  },
};

/** Icon plus word, never colour alone, so the label survives read-aloud. */
export const ScienceBadge: React.FC<ScienceBadgeProps> = ({ kind, date }) => {
  const tone = TONE[kind];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] font-semibold whitespace-nowrap ${tone.className}`}
    >
      <StationIcon name={tone.icon} className="w-3.5 h-3.5 shrink-0" />
      <span>{badgeLabel(kind, date)}</span>
    </span>
  );
};
