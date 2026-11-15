import React from 'react';
import { MissionReport } from '../../types';

interface WinScreenProps {
  report: MissionReport;
}

export const WinScreen: React.FC<WinScreenProps> = ({ report }) => {
  const isFullWin = report.outcome === 'won';

  return (
    <section
      aria-label="Mission result"
      className={`rounded-2xl border-2 p-5 space-y-3 ${
        isFullWin
          ? 'bg-emerald-950/45 border-emerald-400/70'
          : 'bg-amber-950/45 border-amber-400/70'
      }`}
    >
      <div className="space-y-1">
        <span
          className={`inline-block text-[11px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded border ${
            isFullWin
              ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
              : 'bg-amber-500/20 border-amber-400/60 text-amber-200'
          }`}
        >
          {isFullWin ? 'Full Success' : 'Survived'}
        </span>
        <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
          {isFullWin ? 'Mission Completed!' : 'Mission Completed · Low Reserves'}
        </h2>
        <p className="text-sm text-slate-200">
          {isFullWin
            ? 'The crew reached resupply with healthy reserves.'
            : 'The crew reached resupply, but some resources finished low.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
            Mission Score
          </div>
          <div className="font-mono text-xl font-bold text-white">{report.score}</div>
        </div>
        {report.badges.map(badge => (
          <div
            key={badge.id}
            className="rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2"
            title={badge.description}
          >
            <div className="text-xs font-bold text-sky-200">{badge.title}</div>
            <div className="text-[11px] text-slate-400">{badge.description}</div>
          </div>
        ))}
      </div>
    </section>
  );
};