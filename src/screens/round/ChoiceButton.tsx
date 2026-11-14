import React from 'react';
import { ChoiceDefinition } from '../../types';
import { StationIcon } from '../../ui/icons';
import { DetailTap } from '../../ui/DetailTap';

interface ChoiceButtonProps {
  choice: ChoiceDefinition & { disabled: boolean; disabledReason?: string };
  onSelect: (choiceId: string) => void;
  showArrow?: boolean;
}

export const ChoiceButton: React.FC<ChoiceButtonProps> = ({
  choice,
  onSelect,
  showArrow = false,
}) => {
  return (
    <div
      onClick={() => {
        if (!choice.disabled) {
          onSelect(choice.id);
        }
      }}
      role="button"
      tabIndex={choice.disabled ? -1 : 0}
      aria-disabled={choice.disabled}
      onKeyDown={e => {
        if (!choice.disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect(choice.id);
        }
      }}
      className={`group relative rounded-2xl border p-4 transition-all duration-150 flex flex-col justify-between gap-3 text-left ${
        choice.disabled
          ? 'bg-slate-950/60 border-slate-800 opacity-55 cursor-not-allowed'
          : 'bg-gradient-to-b from-slate-800/95 to-slate-900/95 hover:from-slate-800 hover:to-sky-950/40 border-slate-600/80 hover:border-sky-400 hover:-translate-y-0.5 shadow-lg hover:shadow-sky-500/15 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400'
      }`}
    >
      {showArrow && (
        <div className="absolute -top-3.5 right-4 px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 text-xs font-extrabold tracking-wide shadow-md animate-bounce flex items-center gap-1">
          <span>Start here!</span>
          <span aria-hidden="true">↓</span>
        </div>
      )}

      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-transform duration-150 ${
            choice.disabled
              ? 'bg-slate-900 border-slate-800 text-slate-500'
              : 'bg-sky-500/15 border-sky-400/45 text-sky-300 group-hover:scale-105 group-hover:bg-sky-400/20'
          }`}
        >
          <StationIcon name={choice.icon} className="w-5 h-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-display text-sm sm:text-base font-bold text-white leading-snug">
            {choice.label.short}
          </div>
          <div
            className={`mt-0.5 text-xs font-semibold ${
              choice.disabled
                ? 'text-rose-300'
                : choice.costLabel.includes('Free')
                ? 'text-amber-300'
                : 'text-sky-300'
            }`}
          >
            {choice.disabled && choice.disabledReason
              ? choice.disabledReason
              : choice.costLabel}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-700/50">
        <DetailTap
          promptLabel="Why?"
          shortText={choice.why.short}
          detailText={choice.why.detail}
          extraNote={choice.teaches}
        />

        {!choice.disabled && (
          <span className="text-xs font-bold text-sky-300 group-hover:text-sky-200 whitespace-nowrap">
            Choose →
          </span>
        )}
      </div>
    </div>
  );
};
