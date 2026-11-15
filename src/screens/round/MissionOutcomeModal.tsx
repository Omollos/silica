import React from 'react';

interface MissionOutcomeModalProps {
  status: 'won' | 'partial' | 'lost';
  failureReason?: 'oxygen' | 'health' | null;
  onContinue: () => void;
}

export const MissionOutcomeModal: React.FC<MissionOutcomeModalProps> = ({
  status,
  failureReason,
  onContinue,
}) => {
  if (status === 'playing') return null;

  const isWin = status === 'won' || status === 'partial';
  const title = isWin ? 'Mission Complete!' : 'Mission Failed';
  const emoji = isWin ? '🎉' : (failureReason === 'oxygen' ? '😮‍💨' : '🤒');

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={`rounded-2xl border-2 p-6 max-w-md w-full ${
        isWin
          ? 'bg-emerald-950/80 border-emerald-500/75'
          : 'bg-rose-950/80 border-rose-500/75'
      }`}>
        <div className="text-center space-y-4">
          <div className="text-6xl">{emoji}</div>
          <h2 className={`font-display text-3xl font-extrabold ${
            isWin ? 'text-emerald-200' : 'text-rose-200'
          }`}>
            {title}
          </h2>
          <p className={`text-sm ${
            isWin ? 'text-emerald-100' : 'text-rose-100'
          }`}>
            {isWin
              ? 'Your crew survived the lunar mission!'
              : failureReason === 'oxygen'
              ? 'The station ran out of oxygen.'
              : 'Crew health dropped to zero.'}
          </p>
          <button
            type="button"
            onClick={onContinue}
            className={`min-h-[48px] px-6 py-3 rounded-xl font-display text-lg font-extrabold transition-colors cursor-pointer ${
              isWin
                ? 'bg-emerald-400 hover:bg-emerald-300 text-emerald-950'
                : 'bg-rose-400 hover:bg-rose-300 text-rose-950'
            }`}
          >
            View Mission Report
          </button>
        </div>
      </div>
    </div>
  );
};