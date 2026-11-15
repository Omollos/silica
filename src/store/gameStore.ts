import { create } from 'zustand';
import { DifficultyMode, GameState } from '../types';
import { startGame, submitChoice } from '../engine';
import { stopSpeaking } from '../audio/speak';
import {
  playAdvance,
  playFailure,
  playSuccess,
  playWarning,
} from '../audio/sfx';
import { useSettingsStore } from './settingsStore';
import { useNasaDataStore } from './nasaDataStore';

export type ScreenMode = 'title' | 'playing' | 'end';

export interface StatDeltas {
  power: number;
  oxygen: number;
  health: number;
  moonDirt: number;
  shield: number;
}

interface GameStoreState {
  screen: ScreenMode;
  gameState: GameState;
  currentSeed: number;
  difficulty: DifficultyMode;
  lastChoiceId: string | null;
  lastDeltas: StatDeltas | null;
  outcomeModalOpen: boolean;
  setDifficulty: (difficulty: DifficultyMode) => void;
  beginMission: (seed?: number, difficulty?: DifficultyMode) => void;
  choose: (choiceId: string) => void;
  openMissionReport: () => void;
  setOutcomeModalOpen: (open: boolean) => void;
  retrySameScenario: () => void;
  retryNewScenario: () => void;
  goToTitle: () => void;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  screen: 'title',
  currentSeed: 1,
  difficulty: 'standard',
  gameState: startGame(1, 'standard'),
  lastChoiceId: null,
  lastDeltas: null,
  outcomeModalOpen: false,

  setDifficulty: (difficulty: DifficultyMode) => set({ difficulty }),

  beginMission: (seed = 1, difficulty) => {
    stopSpeaking();
    const activeDifficulty = difficulty ?? get().difficulty;
    const { sfxEnabled } = useSettingsStore.getState();
    const { useLiveWeather, spaceWeather } = useNasaDataStore.getState();
    const liveFlareBonus = useLiveWeather
      ? spaceWeather?.recommendedFlareBonus ?? 0
      : 0;

    playAdvance(sfxEnabled);
    useSettingsStore.getState().setSpeakingNow(false);

    set({
      screen: 'playing',
      currentSeed: seed,
      difficulty: activeDifficulty,
      gameState: startGame(seed, activeDifficulty, liveFlareBonus),
      lastChoiceId: null,
      lastDeltas: null,
      outcomeModalOpen: false,
    });
  },

  choose: (choiceId: string) => {
    stopSpeaking();
    useSettingsStore.getState().setSpeakingNow(false);
    const { sfxEnabled } = useSettingsStore.getState();
    const prev = get().gameState;
    const next = submitChoice(prev, choiceId);

    const lastDeltas: StatDeltas = {
      power: next.power - prev.power,
      oxygen: next.oxygen - prev.oxygen,
      health: next.health - prev.health,
      moonDirt: next.moonDirt - prev.moonDirt,
      shield: next.shield - prev.shield,
    };

    if (next.status === 'lost') {
      playFailure(sfxEnabled);
    } else if (next.status === 'won' || next.status === 'partial') {
      playSuccess(sfxEnabled);
    } else if (
      next.scheduledEventMessage ||
      next.lastResults.some(
        r => (r.delta.health ?? 0) < 0 || (r.delta.oxygen ?? 0) < 0 || (r.delta.power ?? 0) < 0
      )
    ) {
      playWarning(sfxEnabled);
    } else {
      playAdvance(sfxEnabled);
    }

    set({
      gameState: next,
      lastChoiceId: choiceId,
      lastDeltas,
      screen: 'playing',
      outcomeModalOpen: next.status !== 'playing',
    });
  },

  openMissionReport: () => {
    const { sfxEnabled } = useSettingsStore.getState();
    playAdvance(sfxEnabled);
    set({ screen: 'end', outcomeModalOpen: false });
  },

  setOutcomeModalOpen: (open: boolean) => set({ outcomeModalOpen: open }),

  retrySameScenario: () => {
    const { currentSeed, difficulty } = get();
    get().beginMission(currentSeed, difficulty);
  },

  retryNewScenario: () => {
    const { currentSeed, difficulty } = get();
    const nextSeed = currentSeed === 1 ? 42 : currentSeed + 17;
    get().beginMission(nextSeed, difficulty);
  },

  goToTitle: () => {
    stopSpeaking();
    useSettingsStore.getState().setSpeakingNow(false);
    const difficulty = get().difficulty;
    set({
      screen: 'title',
      gameState: startGame(1, difficulty),
      currentSeed: 1,
      lastChoiceId: null,
      lastDeltas: null,
      outcomeModalOpen: false,
    });
  },
}));