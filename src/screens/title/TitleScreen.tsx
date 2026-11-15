import React, { useEffect } from 'react';
import { SCENARIO } from '../../engine/events';
import { useGameStore } from '../../store/gameStore';
import { useNasaDataStore } from '../../store/nasaDataStore';
import { MoonGlobe } from '../../three/MoonGlobe';
import { DetailTap } from '../../ui/DetailTap';

interface TitleScreenProps {
  onOpenLibrary: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onOpenLibrary }) => {
  const beginMission = useGameStore(s => s.beginMission);
  const preloadAll = useNasaDataStore(s => s.preloadAll);

  useEffect(() => {
    preloadAll();
  }, [preloadAll]);

  return (
    <div className="relative min-h-screen lg:h-screen w-full overflow-x-hidden lg:overflow-hidden bg-[#050914] text-slate-100">
      {/* Full-Screen Interactive 3D Lunar Orbit Canvas */}
      <div className="fixed inset-0 z-0">
        <MoonGlobe />
      </div>

      {/* Directional Readability Scrims (no backdrop-blur over WebGL) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[1] bg-gradient-to-r from-[#050914]/92 via-[#050914]/55 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[1] bg-gradient-to-t from-[#050914]/80 via-transparent to-[#050914]/45"
      />

      {/* Foreground Hero Layout */}
      <div className="relative z-10 max-w-6xl mx-auto min-h-screen lg:h-full px-6 sm:px-10 py-10 flex flex-col justify-between lg:justify-center">
        {/* Left: Editorial Hero Typography & Primary Actions */}
        <div className="max-w-xl space-y-6">
          <div className="space-y-4">
            <div
              aria-hidden="true"
              className="h-0.5 w-16 rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-transparent"
            />
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.03] bg-gradient-to-br from-white via-slate-100 to-sky-300 bg-clip-text text-transparent drop-shadow-[0_6px_28px_rgba(56,189,248,0.22)]">
              {SCENARIO.meta.title}
            </h1>
            <p className="text-xl sm:text-2xl font-semibold text-sky-200 max-w-lg leading-snug">
              {SCENARIO.meta.subtitle.short}
            </p>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-lg">
              {SCENARIO.meta.subtitle.detail}
            </p>
          </div>

          {/* Primary Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => beginMission(1, 'standard')}
              className="min-h-[52px] px-7 py-3.5 rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-300 hover:from-sky-300 hover:to-cyan-200 text-slate-950 font-display text-lg font-extrabold shadow-lg shadow-sky-500/30 transition-all hover:-translate-y-0.5 cursor-pointer whitespace-nowrap"
            >
              Launch Mission →
            </button>

            <button
              type="button"
              onClick={onOpenLibrary}
              className="min-h-[48px] px-4 py-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-600/80 text-sm font-semibold text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
            >
              Science Library
            </button>
          </div>
        </div>

        {/* Floating Shackleton Crater Target HUD */}
        <div className="mt-10 lg:mt-0 lg:fixed lg:bottom-8 lg:right-8 w-full sm:w-auto max-w-sm rounded-2xl bg-[#070b14]/92 border border-sky-400/30 px-4 py-3 shadow-2xl flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="inline-flex items-center gap-2 text-slate-100 font-semibold">
              <span
                aria-hidden="true"
                className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.9)]"
              />
              Target: Shackleton Crater
            </span>
          </div>
          <DetailTap
            promptLabel="Why Shackleton?"
            detailText={SCENARIO.meta.location.detail}
          />
        </div>
      </div>
    </div>
  );
};