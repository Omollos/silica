import React from 'react';
import { useGameStore } from '../../store/gameStore';

interface TitleScreenProps {
  onOpenLibrary: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onOpenLibrary }) => {
  const beginMission = useGameStore(s => s.beginMission);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex items-center justify-center px-4">
      <div className="max-w-2xl mx-auto text-center space-y-6">
        <h1 className="font-display text-4xl sm:text-6xl font-extrabold text-white">
          SILICA STATION
        </h1>
        <p className="text-lg sm:text-xl text-slate-300">
          A Lunar Survival Decision Game
        </p>
        <p className="text-sm sm:text-base text-slate-400 max-w-lg mx-auto">
          Command a Moon outpost and make critical decisions to keep your crew alive through 12 rounds of challenges.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => beginMission()}
            className="min-h-[48px] px-6 py-3 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-display text-lg font-extrabold transition-colors cursor-pointer"
          >
            Start Mission
          </button>
          <button
            type="button"
            onClick={onOpenLibrary}
            className="min-h-[48px] px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-display text-base font-bold transition-colors cursor-pointer"
          >
            Science Library
          </button>
        </div>

        <div className="pt-8 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Choose Difficulty
          </h3>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {(['cadet', 'standard', 'commander'] as const).map(diff => (
              <button
                key={diff}
                type="button"
                onClick={() => useGameStore.getState().setDifficulty(diff)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-semibold text-sm capitalize transition-colors cursor-pointer"
              >
                {diff}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};