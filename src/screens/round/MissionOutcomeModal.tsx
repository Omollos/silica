import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { buildReport } from '../../engine';
import { GameState, SkyState } from '../../types';
import { AstronautFace } from '../../ui/AstronautFace';
import { StationIcon } from '../../ui/icons';
import { SpeakerButton } from '../../ui/SpeakerButton';

interface MissionOutcomeModalProps {
  gameState: GameState;
  sky: SkyState;
  onViewReport: () => void;
  onRetrySame: () => void;
  onRetryNew: () => void;
  onGoToTitle: () => void;
  onDismiss: () => void;
}

export const MissionOutcomeModal: React.FC<MissionOutcomeModalProps> = ({
  gameState,
  sky,
  onViewReport,
  onRetrySame,
  onRetryNew,
  onGoToTitle,
  onDismiss,
}) => {
  const report = buildReport(gameState);
  const isLost = report.outcome === 'lost';
  const isFullWin = report.outcome === 'won';

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onDismiss]);

  const title = isLost
    ? 'Mission Failed!'
    : isFullWin
    ? 'Mission Completed!'
    : 'Mission Completed · Low Reserves';

  const subtitle = isLost
    ? report.failureReason === 'oxygen'
      ? `Oxygen depleted to 0% in Round ${report.roundsSurvived}. Cabin life support shut down before resupply.`
      : report.finalHealth <= 0
      ? `Crew health dropped to 0% in Round ${report.roundsSurvived} due to radiation, cold stress, or shortages.`
      : `Crew health fell to ${report.finalHealth}% at Round ${report.roundsSurvived}—below the 50% resupply survival requirement.`
    : isFullWin
    ? 'The Earth resupply spacecraft docked safely at Shackleton Crater and your whole crew survived healthy!'
    : 'You reached Round 12 and the resupply rocket docked, though crew reserves finished tight.';

  const speechText = `${title} ${subtitle} ${report.biggestLinkHint.short}`;

  const accentCard = isLost
    ? 'border-rose-500/80 shadow-[0_0_48px_rgba(244,63,94,0.38)]'
    : isFullWin
    ? 'border-emerald-400/80 shadow-[0_0_48px_rgba(52,211,153,0.34)]'
    : 'border-amber-400/80 shadow-[0_0_48px_rgba(251,191,36,0.32)]';

  const badgeTone = isLost
    ? 'bg-rose-500/20 border-rose-400/60 text-rose-200'
    : isFullWin
    ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
    : 'bg-amber-500/20 border-amber-400/60 text-amber-200';

  const iconWrap = isLost
    ? 'bg-rose-500/25 border-rose-400/60 text-rose-200'
    : isFullWin
    ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-200'
    : 'bg-amber-500/25 border-amber-400/60 text-amber-200';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mission-outcome-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        className={`w-full max-w-xl rounded-2xl bg-[#070b14] border-2 ${accentCard} p-5 sm:p-6 space-y-4`}
      >
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5 min-w-0">
            <div
              className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${iconWrap}`}
            >
              <StationIcon name={isLost ? 'warning' : 'ship'} className="w-6 h-6" />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-block text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border ${badgeTone}`}
                >
                  {isLost ? 'Emergency Alert' : 'Mission Success'}
                </span>
                <span className="text-xs font-mono text-slate-400 tabular-nums">
                  Round {report.roundsSurvived}/12
                </span>
              </div>
              <h2
                id="mission-outcome-title"
                className="font-display text-2xl sm:text-3xl font-extrabold text-white leading-tight"
              >
                {title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer whitespace-nowrap shrink-0"
          >
            Inspect 3D
          </button>
        </div>

        {/* Summary + Crew Mood */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-slate-900/90 border border-slate-800 p-3.5">
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
            {subtitle}
          </p>
          <div className="shrink-0">
            <AstronautFace
              health={report.finalHealth}
              oxygen={report.finalOxygen}
              sick={gameState.sick}
              sky={sky}
              status={report.outcome}
            />
          </div>
        </div>

        {/* Telemetry Summary */}
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            {
              label: isLost ? 'Survived' : 'Score',
              value: isLost ? `${report.roundsSurvived}/12` : `${report.score}`,
              alert: false,
            },
            {
              label: 'Power',
              value: `${report.finalPower}`,
              alert: report.finalPower === 0,
            },
            {
              label: 'Oxygen',
              value: `${report.finalOxygen}%`,
              alert: report.finalOxygen === 0 || report.failureReason === 'oxygen',
            },
            {
              label: 'Health',
              value: `${report.finalHealth}%`,
              alert: report.failureReason === 'health',
            },
          ].map((stat, idx) => (
            <div
              key={idx}
              className={`rounded-xl border px-2 py-2 ${
                stat.alert
                  ? 'bg-rose-950/60 border-rose-500/70'
                  : 'bg-slate-900/90 border-slate-800'
              }`}
            >
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                {stat.label}
              </div>
              <div
                className={`font-mono text-base sm:text-lg font-extrabold tabular-nums mt-0.5 ${
                  stat.alert ? 'text-rose-300' : 'text-white'
                }`}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Key Lesson */}
        <div className="rounded-xl bg-sky-950/35 border border-sky-400/40 px-3.5 py-2.5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-sky-300">
              {isLost ? 'Why It Happened' : 'Mission Highlight'}
            </div>
            <p className="text-xs sm:text-sm font-semibold text-white leading-snug mt-0.5">
              {report.biggestLinkHint.short}
            </p>
          </div>
          <SpeakerButton text={speechText} label="Read" />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={onViewReport}
            className={`min-h-[44px] px-4 py-2 rounded-xl font-display text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
              isLost
                ? 'bg-rose-500 hover:bg-rose-400 text-white'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
            }`}
          >
            View Full Report →
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRetrySame}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs sm:text-sm font-semibold text-white cursor-pointer whitespace-nowrap"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={onRetryNew}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/50 text-xs sm:text-sm font-semibold text-sky-200 cursor-pointer whitespace-nowrap"
            >
              New Mission
            </button>
            <button
              type="button"
              onClick={onGoToTitle}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 cursor-pointer whitespace-nowrap"
            >
              Back
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
