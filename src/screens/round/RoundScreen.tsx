import React from 'react';

interface RoundScreenProps {
  onOpenLibrary: () => void;
}

export const RoundScreen: React.FC<RoundScreenProps> = ({ onOpenLibrary }) => {
  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 px-4 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            Round Screen
          </h1>
          <p className="text-slate-400">
            Game round implementation will go here
          </p>
        </div>
        <div className="rounded-2xl bg-slate-900/90 border border-slate-700/80 p-6">
          <p className="text-slate-300 text-center">
            This is where the main gameplay loop will be implemented.
          </p>
        </div>
      </div>
    </div>
  );
};