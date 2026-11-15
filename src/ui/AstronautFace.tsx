import React from 'react';
import { SkyState } from '../types';

interface AstronautFaceProps {
  health: number;
  oxygen: number;
  sick: boolean;
  sky: SkyState;
  status: 'playing' | 'won' | 'partial' | 'lost';
}

export const AstronautFace: React.FC<AstronautFaceProps> = ({
  health,
  oxygen,
  sick,
  sky,
  status,
}) => {
  const danger = status === 'lost' || health <= 30 || oxygen <= 30;
  const expression = danger ? ':( ' : sick ? ':-|' : ':)';
  const mood = status === 'lost'
    ? 'Crew in danger'
    : status === 'won'
    ? 'Crew thriving'
    : status === 'partial'
    ? 'Crew survived'
    : sick
    ? 'Crew unwell'
    : 'Crew stable';

  return (
    <div
      role="status"
      aria-label={`${mood}. Health ${health}, oxygen ${oxygen}.`}
      className={`min-h-[72px] rounded-xl border px-3 py-2 flex items-center gap-3 ${
        danger
          ? 'bg-rose-950/85 border-rose-400/60'
          : 'bg-slate-900/90 border-slate-700/80'
      }`}
    >
      <div
        aria-hidden="true"
        className={`w-11 h-11 rounded-full border-2 flex items-center justify-center font-mono text-lg font-bold ${
          danger
            ? 'bg-rose-500/20 border-rose-300 text-rose-100'
            : 'bg-sky-500/20 border-sky-300 text-sky-100'
        }`}
      >
        {expression}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-bold text-white">{mood}</div>
        <div className="text-[11px] text-slate-300">
          {sick ? 'Needs medical care' : `${sky === 'night' ? 'Lunar night' : 'Station'} crew`}
        </div>
      </div>
    </div>
  );
};