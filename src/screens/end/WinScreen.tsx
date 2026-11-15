import React from 'react';
import { MissionReport as MissionReportType } from '../../types';

interface WinScreenProps {
  report: MissionReportType;
}

export const WinScreen: React.FC<WinScreenProps> = ({ report }) => {
  const isFullWin = report.outcome === 'won';

  return (
    <div className="space-y-4">
      <div
        className={`rounded-2xl border p-5 ${
          isFullWin
            ? 'bg-emerald-950/35 border-emerald-400/50'
            : 'bg-amber-950/35 border-amber-400/50'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                isFullWin
                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                  : 'bg-amber-500/20 border-amber-400/40 text-amber-300'
              }`}
            >
              <span className="text-2xl">🚀</span>
            </div>
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                {isFullWin
                  ? 'Mission Complete!'
                  : 'Crew Reached Resupply (Low Reserves)'}
              </h2>
              <p className="text-sm text-slate-200">
                {isFullWin
                  ? 'The resupply spacecraft docked safely and your crew is healthy!'
                  : 'You survived all 12 rounds, though your crew finished worn down.'}
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-950/80 border border-slate-700 px-4 py-2 text-center">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              Crew Score
            </div>
            <div className="font-mono text-2xl font-extrabold text-white tabular-nums">
              {report.score}
            </div>
          </div>
        </div>
      </div>

      {report.badges.length > 0 && (
        <div className="rounded-2xl bg-slate-900/90 border border-slate-700/80 p-4 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
            Mission Badges Earned ({report.badges.length} / 6)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {report.badges.map(badge => (
              <div
                key={badge.id}
                className="rounded-xl bg-slate-950/75 border border-amber-400/35 px-3 py-2.5 flex items-start gap-2.5"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-400/15 border border-amber-400/35 text-amber-300 flex items-center justify-center shrink-0">
                  <span className="text-lg">🏅</span>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white leading-tight">
                    {badge.title}
                  </div>
                  <div className="text-[11px] text-slate-300 leading-snug mt-0.5">
                    {badge.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.checkupApplied.length > 0 && (
        <div className="rounded-2xl bg-slate-900/90 border border-slate-700/80 p-4 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-sky-300">
            Resupply Check-Up (Rounds 10–12 Choices Landed)
          </div>
          <div className="space-y-1.5">
            {report.checkupApplied.map((item, idx) => (
              <div
                key={`${item.sourceRound}-${idx}`}
                className="text-xs sm:text-sm text-slate-200 flex items-center gap-2"
              >
                <span className="font-mono text-slate-400">
                  [Rd {item.sourceRound}]
                </span>
                <span>{item.reason.short}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};