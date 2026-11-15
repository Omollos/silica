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
}) => (
  <div className="flex flex-wrap items-center gap-2">
    <button
      type="button"
      onClick={onSameScenario}
      className="min-h-[44px] rounded-xl bg-sky-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-sky-300 cursor-pointer"
    >
      Retry Mission
    </button>
    <button
      type="button"
      onClick={onNewScenario}
      className="min-h-[44px] rounded-xl border border-sky-400/50 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-500/20 cursor-pointer"
    >
      Try New Scenario
    </button>
    <button
      type="button"
      onClick={onTitle}
      className="min-h-[44px] rounded-xl border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
    >
      Back to Title
    </button>
  </div>
);