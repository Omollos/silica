import React, { useState } from 'react';
import { GameState, SkyState } from '../../types';
import { playClick } from '../../audio/sfx';
import { useSettingsStore } from '../../store/settingsStore';
import { useNasaDataStore } from '../../store/nasaDataStore';

interface CrewCommsProps {
  gameState: GameState;
  sky: SkyState;
}

function getCrewTip(
  gameState: GameState,
  sky: SkyState,
  donkiText?: string,
  radLabPeak?: number
): {
  speaker: string;
  role: string;
  color: string;
  line: string;
  scienceNote?: string;
} {
  if (gameState.sick) {
    return {
      speaker: 'Med. Sam',
      role: 'Flight Doctor',
      color: 'text-rose-300',
      line: 'Someone caught a chill from cold air! Treating them stops the sickness from spreading to the whole crew.',
      scienceNote: 'NASA OSDR biology studies track how cold stress and closed-cabin life affect astronaut immune systems.',
    };
  }
  if (sky === 'flare') {
    return {
      speaker: 'Cmdr. Maya',
      role: 'Mission Leader',
      color: 'text-amber-300',
      line: `Solar storm right overhead! Our Roof Shield (${Math.min(30, gameState.shield)}/30) blocks first, and Shelter cuts the rest in half.`,
      scienceNote:
        donkiText ??
        (radLabPeak
          ? `NASA RadLab ISS sensors recorded spikes up to ${radLabPeak} µGy/hr in high-radiation zones.`
          : undefined),
    };
  }
  if (gameState.power <= 20) {
    return {
      speaker: 'Eng. Leo',
      role: 'Power Systems',
      color: 'text-amber-300',
      line: 'Batteries are running low! If Power hits 0, our oxygen scrubbers stop and we lose double air.',
    };
  }
  if (gameState.oxygen <= 35 && !gameState.queue.some(q => (q.delta.oxygen ?? 0) > 0)) {
    return {
      speaker: 'Sci. Priya',
      role: 'Life Support',
      color: 'text-sky-300',
      line: 'Oxygen tanks are getting tight! Baking moon dirt or sending the rover for crater ice brings oxygen in 3 rounds.',
    };
  }
  if (gameState.round === 3 || gameState.round === 4) {
    return {
      speaker: 'Eng. Leo',
      role: 'Power Systems',
      color: 'text-sky-300',
      line: 'Dark Lunar Night starts in Round 5 and lasts 5 rounds with zero sunlight. Protect your battery power!',
    };
  }
  if (gameState.round === 6) {
    return {
      speaker: 'Sci. Priya',
      role: 'Life Support',
      color: 'text-emerald-300',
      line: 'Supply ship is delayed! Our CSA-style Greenhouse grows fresh food (+6 health) and recycles CO₂ into +32 oxygen in 3 rounds.',
      scienceNote: 'CSA Lunar Food & Remote Farming shows plants help nourish crews when Earth rockets run late.',
    };
  }
  if (gameState.round === 7) {
    return {
      speaker: 'Cmdr. Maya',
      role: 'Mission Leader',
      color: 'text-amber-300',
      line: 'Watch out for the Round 8 Solar Flare! Keep at least 20 Power ready if you want to take Shelter.',
      scienceNote: donkiText,
    };
  }
  if (gameState.round >= 10) {
    return {
      speaker: 'Sci. Priya',
      role: 'Life Support',
      color: 'text-emerald-300',
      line: 'Almost at Round 12! Remember: choices in Rounds 10–12 still count during the final Resupply Check-Up.',
      scienceNote:
        gameState.round === 11
          ? 'NASA OSDR study OSD-342 shows daily exercise protects astronaut bones and muscles in low gravity!'
          : undefined,
    };
  }
  return {
    speaker: 'Cmdr. Maya',
    role: 'Mission Leader',
    color: 'text-sky-300',
    line: 'Look 3 rounds ahead! You start with 85 Oxygen for 12 rounds (which burns 144), so baking moon dirt into Air or growing greens is vital.',
  };
}

export const CrewComms: React.FC<CrewCommsProps> = ({ gameState, sky }) => {
  const [open, setOpen] = useState(false);
  const sfxEnabled = useSettingsStore(s => s.sfxEnabled);
  const spaceWeather = useNasaDataStore(s => s.spaceWeather);
  const radLab = useNasaDataStore(s => s.radLab);

  const donkiSummary = spaceWeather
    ? `Live NASA DONKI: ${spaceWeather.activityLevel} (${spaceWeather.cmeCount} recent CMEs, max Kp ${spaceWeather.maxKpIndex || 0}).`
    : undefined;

  const tip = getCrewTip(gameState, sky, donkiSummary, radLab?.peakDoseMicroGyHr);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => {
          playClick(sfxEnabled);
          setOpen(v => !v);
        }}
        aria-expanded={open}
        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-600/80 text-xs font-semibold text-emerald-200 transition-colors cursor-pointer whitespace-nowrap"
      >
        {open ? 'Hide Crew Radio' : 'Ask Crew for Advice'}
      </button>

      {open && (
        <div className="w-full rounded-xl bg-slate-950/90 border border-emerald-400/35 px-3.5 py-2.5 space-y-1.5 text-xs sm:text-sm text-slate-200">
          <div>
            <span className={`font-bold ${tip.color}`}>
              {tip.speaker} ({tip.role}):{' '}
            </span>
            <span>“{tip.line}”</span>
          </div>
          {tip.scienceNote && (
            <div className="text-xs text-sky-300/90 pt-1 border-t border-slate-800">
              {tip.scienceNote}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
