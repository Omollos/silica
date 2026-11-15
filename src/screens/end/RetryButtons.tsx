import React from 'react';

interface RetryButtonsProps {
  onSameScenario: () => void;
  onNewScenario: () => void;
  onTitle: () => void;
}

export const RetryButtons: React.FC<RetryButtonsProps> = ({
  onSameScenario,
  onNewScenario,
  onTitle,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-3 pt-2">
      <button
        type="button"
        onClick={onSameScenario}
        className="min-h-[48px] px-5 py-3 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-display text-base font-extrabold transition-colors cursor-pointer whitespace-nowrap"
      >
        Try Again · Same Scenario
      </button>

      <button
        type="button"
        onClick={onNewScenario}
        className="min-h-[48px] px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-display text-base font-bold transition-colors cursor-pointer whitespace-nowrap"
      >
        Try Again · New Scenario
      </button>

      <button
        type="button"
        onClick={onTitle}
        className="min-h-[48px] px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sm font-semibold text-slate-300 transition-colors cursor-pointer whitespace-nowrap"
      >
        Back
      </button>
    </div>
  );
};