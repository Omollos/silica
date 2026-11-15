import React, { useState } from 'react';
import { ReportChainLink } from '../../types';
import { StationIcon } from '../../ui/icons';

interface ReportChainProps {
  chainLines: ReportChainLink[];
}

export const ReportChain: React.FC<ReportChainProps> = ({ chainLines }) => {
  const [openRound, setOpenRound] = useState<number | null>(
    chainLines[0]?.round ?? null
  );

  return (
    <div className="space-y-2.5">
      <h3 className="font-display text-lg font-bold text-white">
        Mission Black Box · 3 Key Decisions
      </h3>
      <p className="text-xs sm:text-sm text-slate-400">
        Tap any decision below to see how your choice returned 3 rounds later.
      </p>

      <div className="space-y-2">
        {chainLines.map(link => {
          const isOpen = openRound === link.round;
          return (
            <div
              key={`${link.round}-${link.actionShort}`}
              className="rounded-2xl bg-slate-900/90 border border-slate-700/80 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpenRound(isOpen ? null : link.round)}
                aria-expanded={isOpen}
                className="w-full text-left px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-800/80 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/35 text-sky-300 flex items-center justify-center shrink-0">
                    <StationIcon name={link.icon} className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-slate-400">
                      Round {link.round} · {link.costShort}
                    </div>
                    <div className="font-display text-sm sm:text-base font-bold text-white truncate">
                      {link.actionShort} →{' '}
                      <span className="text-sky-200 font-semibold">
                        {link.consequenceShort}
                      </span>
                    </div>
                  </div>
                </div>
                <span className="text-xs font-semibold text-sky-300 shrink-0 whitespace-nowrap">
                  {isOpen ? 'Hide' : 'Why?'}
                </span>
              </button>

              {isOpen && (
                <div className="px-4 pb-3.5 pt-2 border-t border-slate-800 text-xs sm:text-sm text-slate-200 leading-relaxed bg-slate-950/50">
                  {link.detail}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};