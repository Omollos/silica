import { create } from 'zustand';
import {
  NasaSpaceWeather,
  OsdrResponse,
  OsdrTopic,
  RadLabSummary,
} from '../types';

interface NasaDataStoreState {
  spaceWeather: NasaSpaceWeather | null;
  weatherLoading: boolean;
  weatherError: string | null;

  radLab: RadLabSummary | null;
  radLabLoading: boolean;
  radLabError: string | null;

  osdrTopic: OsdrTopic;
  osdrCache: Partial<Record<OsdrTopic, OsdrResponse>>;
  osdrLoading: boolean;
  osdrError: string | null;

  useLiveWeather: boolean;
  setUseLiveWeather: (enabled: boolean) => void;
  fetchSpaceWeather: (force?: boolean) => Promise<void>;
  fetchRadLab: (force?: boolean) => Promise<void>;
  fetchOsdr: (topic: OsdrTopic, force?: boolean) => Promise<void>;
  preloadAll: () => void;
}

export const useNasaDataStore = create<NasaDataStoreState>((set, get) => ({
  spaceWeather: null,
  weatherLoading: false,
  weatherError: null,

  radLab: null,
  radLabLoading: false,
  radLabError: null,

  osdrTopic: 'bone',
  osdrCache: {},
  osdrLoading: false,
  osdrError: null,

  useLiveWeather: true,
  setUseLiveWeather: (enabled: boolean) => set({ useLiveWeather: enabled }),

  fetchSpaceWeather: async (force = false) => {
    if (!force && (get().spaceWeather || get().weatherLoading)) return;
    set({ weatherLoading: true, weatherError: null });
    try {
      const res = await fetch('/api/nasa/space-weather');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as NasaSpaceWeather;
      set({ spaceWeather: data, weatherLoading: false });
    } catch {
      set({
        weatherLoading: false,
        weatherError: 'Could not reach NASA DONKI right now.',
      });
    }
  },

  fetchRadLab: async (force = false) => {
    if (!force && (get().radLab || get().radLabLoading)) return;
    set({ radLabLoading: true, radLabError: null });
    try {
      const res = await fetch('/api/nasa/radlab');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as RadLabSummary;
      set({ radLab: data, radLabLoading: false });
    } catch {
      set({
        radLabLoading: false,
        radLabError: 'Could not reach NASA RadLab right now.',
      });
    }
  },

  fetchOsdr: async (topic: OsdrTopic, force = false) => {
    set({ osdrTopic: topic });
    if (!force && get().osdrCache[topic]) return;
    set({ osdrLoading: true, osdrError: null });
    try {
      const res = await fetch(`/api/nasa/osdr?topic=${encodeURIComponent(topic)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as OsdrResponse;
      set(state => ({
        osdrCache: { ...state.osdrCache, [topic]: data },
        osdrLoading: false,
      }));
    } catch {
      set({
        osdrLoading: false,
        osdrError: 'Could not reach NASA OSDR right now.',
      });
    }
  },

  preloadAll: () => {
    void get().fetchSpaceWeather();
    void get().fetchRadLab();
    void get().fetchOsdr(get().osdrTopic);
  },
}));