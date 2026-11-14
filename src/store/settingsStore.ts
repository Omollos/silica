import { create } from 'zustand';
import { stopSpeaking } from '../audio/speak';

interface SettingsState {
  readAloudEnabled: boolean;
  sfxEnabled: boolean;
  speakingNow: boolean;
  setSpeakingNow: (val: boolean) => void;
  toggleReadAloud: () => void;
  toggleSfx: () => void;
}

export const useSettingsStore = create<SettingsState>(set => ({
  readAloudEnabled: true,
  sfxEnabled: true,
  speakingNow: false,
  setSpeakingNow: (val: boolean) => set({ speakingNow: val }),
  toggleReadAloud: () =>
    set(state => {
      if (state.readAloudEnabled) {
        stopSpeaking();
      }
      return {
        readAloudEnabled: !state.readAloudEnabled,
        speakingNow: false,
      };
    }),
  toggleSfx: () => set(state => ({ sfxEnabled: !state.sfxEnabled })),
}));