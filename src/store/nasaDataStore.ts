import { create } from 'zustand';
import {
  NasaFlareWindow,
  NasaSnapshot,
  NasaSpaceWeather,
  OsdrResponse,
  OsdrTopic,
  RadLabSummary,
} from '../types';

interface NasaDataStoreState {
  snapshot: NasaSnapshot | null;
  snapshotLoading: boolean;
  snapshotError: string | null;

  flares: NasaFlareWindow | null;
  flaresLoading: boolean;

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
  fetchSnapshot: (force?: boolean) => Promise<void>;
  fetchSpaceWeather: (force?: boolean) => Promise<void>;
  fetchFlares: (force?: boolean) => Promise<void>;
  fetchRadLab: (force?: boolean) => Promise<void>;
  fetchOsdr: (topic: OsdrTopic, force?: boolean) => Promise<void>;
  preloadAll: () => void;
}

/** Calm, child-safe copy. Never an error code and never a red message. */
const CALM = {
  weather: "NASA's news feed is resting right now.",
  radiation: "NASA's ISS dose chart is resting right now.",
  studies: "NASA's study shelf is resting right now.",
};

let snapshotRequest: Promise<void> | null = null;

export const useNasaDataStore = create<NasaDataStoreState>((set, get) => ({
  snapshot: null,
  snapshotLoading: false,
  snapshotError: null,

  flares: null,
  flaresLoading: false,

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

  /**
   * Today's NASA briefing. One request per page load: the server guarantees it
   * is identical for the whole UTC day, and the game pins it to the run.
   */
  fetchSnapshot: (force = false) => {
    if (!force && get().snapshot) return Promise.resolve();
    if (!force && snapshotRequest) return snapshotRequest;

    set({ snapshotLoading: true, snapshotError: null });
    const request = (async () => {
      try {
        const res = await fetch('/api/nasa/snapshot');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as NasaSnapshot;
        set({ snapshot: data, snapshotLoading: false });
      } catch {
        set({ snapshotLoading: false, snapshotError: CALM.weather });
      } finally {
        snapshotRequest = null;
      }
    })();
    snapshotRequest = request;
    return request;
  },

  fetchFlares: async (force = false) => {
    if (!force && (get().flares || get().flaresLoading)) return;
    set({ flaresLoading: true });
    try {
      const res = await fetch('/api/nasa/flares');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as NasaFlareWindow;
      set({ flares: data, flaresLoading: false });
    } catch {
      // Quiet failure: the Science Library shows the snapshot's flare instead.
      set({ flaresLoading: false });
    }
  },

  fetchSpaceWeather: async (force = false) => {
    if (!force && (get().spaceWeather || get().weatherLoading)) return;
    set({ weatherLoading: true, weatherError: null });
    try {
      const res = await fetch('/api/nasa/space-weather');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as NasaSpaceWeather;
      set({ spaceWeather: data, weatherLoading: false });
    } catch {
      set({ weatherLoading: false, weatherError: CALM.weather });
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
      set({ radLabLoading: false, radLabError: CALM.radiation });
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
      set({ osdrLoading: false, osdrError: CALM.studies });
    }
  },

  preloadAll: () => {
    void get().fetchSnapshot();
    void get().fetchSpaceWeather();
    void get().fetchFlares();
    void get().fetchRadLab();
    void get().fetchOsdr(get().osdrTopic);
  },
}));
