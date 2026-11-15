import React from 'react';
import { StationScene } from './StationScene';
import { GameState } from '../types';

interface StationSceneProps {
  gameState: GameState;
  sky: string;
  lastChoiceId: string | null;
}

export const StationScene: React.FC<StationSceneProps> = ({ gameState, sky, lastChoiceId }) => {
  const getSkyEmoji = () => {
    switch (sky) {
      case 'day': return '☀️';
      case 'night': return '🌙';
      case 'flare': return '💥';
      case 'dawn': return '🌅';
      case 'resupply': return '🚀';
      default: return '🌑';
    }
  };

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-slate-700/80 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-bold text-white">
          Station View
        </h3>
        <div className="text-4xl">
          {getSkyEmoji()}
        </div>
      </div>
      <div className="text-center py-8">
        <div className="text-6xl mb-4">🏗️</div>
        <p className="text-slate-400">
          Station rendering will be implemented here
        </p>
      </div>
    </div>
  );
};