import React from 'react';
import { IconName } from '../types';
import { StationIcon } from './icons';

type BarTone = 'power' | 'oxygen' | 'health';

interface BarProps {
  label: string;
  value: number;
  max: number;
  icon: IconName;
  tone: BarTone;
  delta?: number;
  note?: string;
}

const toneStyles: Record<BarTone, { fill: string; text: string }> = {
  power: { fill: 'bg-amber-400', text: 'text-amber-200' },
  oxygen: { fill: 'bg-sky-400', text: 'text-sky-200' },
  health: { fill: 'bg-emerald-400', text: 'text-emerald-200' },
};

export const Bar: React.FC<BarProps> = ({
  label,
  value,
  max,
  icon,
  tone,
  delta,
  note,
}) => {
  const percentage = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const colors = toneStyles[tone];

  return (
    <div
      role="group"
      aria-label={`${label}: ${value} of ${max}${note ? `. ${note}` : ''}`}
      className="min-h-[72px] rounded-xl bg-[#070b14]/95 border border-slate-700/80 px-3 py-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${colors.text}`}>
          <StationIcon name={icon} className="w-4 h-4" />
          {label}
        </span>
        <span className="font-mono text-sm font-bold text-white tabular-nums">
          {value}
          <span className="text-slate-500">/{max}</span>
          {delta !== undefined && delta !== 0 && (
            <span className={`ml-1 text-[10px] ${delta > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {delta > 0 ? '+' : ''}{delta}
            </span>
          )}
        </span>
      </div>
      <div
        aria-hidden="true"
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"
      >
        <div
          className={`h-full rounded-full transition-[width] ${colors.fill}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {note && (
        <p className="mt-1 text-[10px] leading-tight text-rose-200">{note}</p>
      )}
    </div>
  );
};