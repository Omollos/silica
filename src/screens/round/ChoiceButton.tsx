import React from 'react';
import { StationIcon } from '../ui/icons';

interface ChoiceButtonProps {
  id: string;
  icon: any;
  label: { short: string; detail: string };
  costLabel: string;
  why: { short: string; detail: string };
  disabled: boolean;
  disabledReason?: string;
  onClick: (id: string) => void;
}

export const ChoiceButton: React.FC<ChoiceButtonProps> = ({
  id,
  icon,
  label,
  costLabel,
  why,
  disabled,
  disabledReason,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      disabled={disabled}
      className={`w-full text-left rounded-2xl border p-4 transition-all ${
        disabled
          ? 'bg-slate-900/50 border-slate-700/50 cursor-not-allowed opacity-60'
          : 'bg-slate-900/90 border-slate-700/80 hover:bg-slate-800/90 hover:border-slate-600 cursor-pointer'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/35 text-sky-300 flex items-center justify-center shrink-0">
          <StationIcon name={icon} className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="font-display text-base font-bold text-white">
              {label.short}
            </h3>
            <span className="text-xs font-mono text-amber-300 shrink-0">
              {costLabel}
            </span>
          </div>
          <p className="text-sm text-slate-300 mb-2">
            {label.detail}
          </p>
          <p className="text-xs text-slate-400 italic">
            {why.short}
          </p>
          {disabled && disabledReason && (
            <p className="text-xs text-rose-400 mt-2 font-semibold">
              {disabledReason}
            </p>
          )}
        </div>
      </div>
    </button>
  );
};