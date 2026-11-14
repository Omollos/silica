import React from 'react';
import { GameState, TextPair } from '../../types';
import { StationIcon } from '../../ui/icons';
import { DetailTap } from '../../ui/DetailTap';

interface ResultLineProps {
  lastResults: GameState['lastResults'];
  scheduledEventMessage: TextPair | null;
}

export const ResultLine: React.FC<ResultLineProps> = ({
  lastResults,
  scheduledEventMessage,
}) => {
  if (lastResults.length === 0 && !scheduledEventMessage) {
    return null;
  }

  return (
    <div className="space-y-2">
      {scheduledEventMessage && (
        <div className="rounded-2xl bg-rose-500/15 border border-rose-400/50 px-3.5 py-2.5 flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <span className="text-rose-300 shrink-0 mt-0.5">
              <StationIcon name="flare" className="w-4 h-4" />
            </span>
            <p className="text-xs sm:text-sm font-bold text-rose-100 leading-snug">
              {scheduledEventMessage.short}
            </p>
          </div>
          <DetailTap
            promptLabel="Details"
            detailText={scheduledEventMessage.detail}
          />
        </div>
      )}

      {lastResults.map((res, idx) => {
        const isNegative =
          (res.delta.health ?? 0) < 0 ||
          (res.delta.oxygen ?? 0) < 0 ||
          (res.delta.power ?? 0) < 0;

        return (
          <div
            key={`${res.sourceRound}-${idx}`}
            className={`rounded-2xl border px-3.5 py-2.5 flex items-start justify-between gap-2 ${
              isNegative
                ? 'bg-rose-950/35 border-rose-400/40'
                : 'bg-sky-950/35 border-sky-400/35'
            }`}
          >
            <div className="flex items-start gap-2 min-w-0">
              <span
                className={`shrink-0 mt-0.5 ${
                  isNegative ? 'text-rose-300' : 'text-sky-300'
                }`}
              >
                <StationIcon name={res.icon} className="w-4 h-4" />
              </span>
              <p className="text-xs sm:text-sm font-semibold text-white leading-snug">
                <span className="text-slate-300 font-mono text-[11px] mr-1">
                  [Rd {res.sourceRound}]
                </span>
                {res.reason.short}
              </p>
            </div>
            <DetailTap promptLabel="Why?" detailText={res.reason.detail} />
          </div>
        );
      })}
    </div>
  );
};
