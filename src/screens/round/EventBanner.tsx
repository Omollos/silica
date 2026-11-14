import React from 'react';
import { IconName, SkyState, TextPair } from '../../types';
import { StationIcon } from '../../ui/icons';
import { DetailTap } from '../../ui/DetailTap';

interface EventBannerProps {
  round: number;
  maxRounds: number;
  chapter: number;
  chapterTitle: string;
  sky: SkyState;
  warning: TextPair | null;
}

const SKY_META: Record<
  SkyState,
  { label: string; icon: IconName; containerClass: string; badgeClass: string }
> = {
  day: {
    label: 'Lunar Day · Solar ON (+30)',
    icon: 'sun',
    containerClass:
      'bg-gradient-to-r from-slate-900/95 via-sky-950/60 to-slate-900/95 border-sky-400/35',
    badgeClass: 'bg-sky-500/20 text-sky-200 border-sky-400/40',
  },
  night: {
    label: 'Lunar Night · Solar OFF (0)',
    icon: 'moon',
    containerClass:
      'bg-gradient-to-r from-slate-950 via-indigo-950/75 to-slate-950 border-indigo-400/40',
    badgeClass: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40',
  },
  flare: {
    label: 'SOLAR FLARE · Radiation Storm!',
    icon: 'flare',
    containerClass:
      'bg-gradient-to-r from-amber-950/70 via-rose-950/65 to-slate-950 border-amber-400/60',
    badgeClass: 'bg-amber-500/25 text-amber-200 border-amber-400/50',
  },
  dawn: {
    label: 'Sun Returns! · Solar ON (+30)',
    icon: 'sun',
    containerClass:
      'bg-gradient-to-r from-slate-900 via-amber-950/40 to-sky-950/50 border-amber-300/40',
    badgeClass: 'bg-amber-400/20 text-amber-100 border-amber-300/45',
  },
  resupply: {
    label: 'Final Round · Resupply Incoming!',
    icon: 'ship',
    containerClass:
      'bg-gradient-to-r from-slate-900 via-emerald-950/50 to-slate-900 border-emerald-400/45',
    badgeClass: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/45',
  },
};

export const EventBanner: React.FC<EventBannerProps> = ({
  round,
  maxRounds,
  chapter,
  chapterTitle,
  sky,
  warning,
}) => {
  const meta = SKY_META[sky];

  return (
    <div className="space-y-2.5">
      <div
        className={`rounded-2xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${meta.containerClass}`}
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-950/70 border border-slate-700/80 px-3 py-1.5 font-mono text-sm sm:text-base font-bold text-white tabular-nums whitespace-nowrap">
            Round {round} <span className="text-slate-400">/ {maxRounds}</span>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Chapter {chapter}
            </div>
            <div className="font-display text-sm sm:text-base font-bold text-white leading-tight">
              {chapterTitle}
            </div>
          </div>
        </div>

        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-semibold whitespace-nowrap ${meta.badgeClass}`}
        >
          <StationIcon name={meta.icon} className="w-4 h-4 shrink-0" />
          <span>{meta.label}</span>
        </div>
      </div>

      {warning && (
        <div
          role="alert"
          className="rounded-2xl bg-amber-500/12 border border-amber-400/50 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-amber-300 shrink-0">
              <StationIcon name="warning" className="w-5 h-5" />
            </span>
            <p className="text-sm sm:text-base font-bold text-amber-100">
              {warning.short}
            </p>
          </div>
          <DetailTap promptLabel="Why?" detailText={warning.detail} />
        </div>
      )}
    </div>
  );
};
