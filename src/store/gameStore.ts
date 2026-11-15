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
import {
  NO_SNAPSHOT_ID,
  pinForRetrySame,
  pinForStart,
  seedForNewScenario,
  waitForSnapshot,
  type FlareBonus,
  type RunPin,
} from './pinRunData';
import { syncRun } from '../api/runsClient';

export type ScreenMode = 'title' | 'playing' | 'end';

export interface StatDeltas {
  power: number;
  oxygen: number;
  health: number;
  moonDirt: number;
  shield: number;
}

export interface BeginMissionOptions {
  /** Set by "Same Scenario": replay the exact pin, no waiting, no refetch. */
  pin?: RunPin;
  /** Overridable only so tests do not wait two real seconds. */
  waitMs?: number;
}

interface GameStoreState {
  screen: ScreenMode;
  gameState: GameState;
  currentSeed: number;
  difficulty: DifficultyMode;
  lastChoiceId: string | null;
  lastDeltas: StatDeltas | null;
  outcomeModalOpen: boolean;
  /** Store-level pin, never engine state: the NASA data this run started with. */
  pinnedSnapshotId: string;
  pinnedBonus: FlareBonus;
  startingMission: boolean;
  setDifficulty: (difficulty: DifficultyMode) => void;
  beginMission: (
    seed?: number,
    difficulty?: DifficultyMode,
    options?: BeginMissionOptions
  ) => Promise<void>;
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
  pinnedSnapshotId: NO_SNAPSHOT_ID,
  pinnedBonus: 0,
  startingMission: false,

  setDifficulty: (difficulty: DifficultyMode) => set({ difficulty }),

  beginMission: async (seed = 1, difficulty, options: BeginMissionOptions = {}) => {
    if (get().startingMission) return;
    set({ startingMission: true });

    const activeDifficulty = difficulty ?? get().difficulty;

    let pin: RunPin = options.pin ?? { snapshotId: NO_SNAPSHOT_ID, bonus: 0 };

    if (!options.pin) {
      const nasa = useNasaDataStore.getState();
      if (nasa.useLiveWeather) {
        const ready = nasa.snapshot ? Promise.resolve() : nasa.fetchSnapshot();
        const arrived = await waitForSnapshot(ready, options.waitMs);
        pin = pinForStart(useNasaDataStore.getState().snapshot, arrived);
      }
    }

    stopSpeaking();
    const { sfxEnabled } = useSettingsStore.getState();
    playAdvance(sfxEnabled);
    useSettingsStore.getState().setSpeakingNow(false);

    const gameState = startGame(seed, activeDifficulty, pin.bonus);
    set({
      screen: 'playing',
      currentSeed: seed,
      difficulty: activeDifficulty,
      gameState,
      pinnedSnapshotId: pin.snapshotId,
      pinnedBonus: pin.bonus,
      lastChoiceId: null,
      lastDeltas: null,
      outcomeModalOpen: false,
      startingMission: false,
    });
    void syncRun(gameState, pin.snapshotId);
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

    if (next.status !== 'playing') void syncRun(next, get().pinnedSnapshotId);
  },

  openMissionReport: () => {
    const { sfxEnabled } = useSettingsStore.getState();
    playAdvance(sfxEnabled);
    set({ screen: 'end', outcomeModalOpen: false });
  },

  setOutcomeModalOpen: (open: boolean) => set({ outcomeModalOpen: open }),

  retrySameScenario: () => {
    const { currentSeed, difficulty, pinnedSnapshotId, pinnedBonus } = get();
    void get().beginMission(currentSeed, difficulty, {
      pin: pinForRetrySame({ snapshotId: pinnedSnapshotId, bonus: pinnedBonus }),
    });
  },

  retryNewScenario: () => {
    const { currentSeed, difficulty } = get();
    void get().beginMission(seedForNewScenario(currentSeed), difficulty);
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
      pinnedSnapshotId: NO_SNAPSHOT_ID,
      pinnedBonus: 0,
    });
  },
}));
