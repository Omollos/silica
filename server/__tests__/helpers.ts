import { expect } from 'vitest';
import { createApp } from '../app';
import { loadConfig, type AppConfig } from '../config';
import { MemoryStore } from '../db/memoryStore';
import { createLogger } from '../logger';
import type { RateLimits } from '../middleware/rateLimit';
import type { RecordedFile } from '../nasa/schemas';
import type { NasaSnapshotService } from '../nasa/snapshot';
import type { FetchLike } from '../services/nasaCache';

export function testConfig(overrides: Record<string, string | undefined> = {}): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    DATA_DIR: './data-test',
    LOG_LEVEL: 'silent',
    NASA_API_KEY: 'TEST_KEY',
    // Tests never touch the disk unless they opt in.
    NASA_SNAPSHOT_DIR: '',
    ...overrides,
  } as NodeJS.ProcessEnv);
}

export interface TestAppOptions {
  store?: MemoryStore;
  nasaFetch?: FetchLike;
  now?: () => number;
  rateLimits?: Partial<RateLimits>;
  config?: AppConfig;
  logSink?: (line: string) => void;
  nasaRecorded?: RecordedFile | null;
  nasaSnapshot?: NasaSnapshotService;
}

export function createTestApp(options: TestAppOptions = {}) {
  const store = options.store ?? new MemoryStore();
  const config = options.config ?? testConfig();
  const logger = options.logSink
    ? createLogger({ level: 'debug', sink: options.logSink })
    : createLogger({ level: 'silent', sink: () => undefined });

  const app = createApp({
    store,
    config,
    logger,
    nasaFetch: options.nasaFetch,
    now: options.now,
    rateLimits: { enabled: false, ...options.rateLimits },
    nasaRecorded: options.nasaRecorded === undefined ? null : options.nasaRecorded,
    nasaSnapshot: options.nasaSnapshot,
  });

  return { app, store, config, logger };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const DONKI_CME = [
  {
    activityID: '2024-05-10T00:00:00-CME-001',
    startTime: '2024-05-10T00:00:00Z',
    note: 'Fast  halo   CME observed by SOHO coronagraphs.',
    link: 'https://example.test/cme',
    cmeAnalyses: [
      { isMostAccurate: false, speed: 400 },
      { isMostAccurate: true, speed: 1200.4 },
    ],
  },
  {
    activityID: '2024-05-11T00:00:00-CME-002',
    startTime: '2024-05-11T00:00:00Z',
    note: 'Slower CME.',
    link: 'https://example.test/cme-2',
    cmeAnalyses: [{ isMostAccurate: true, speed: 650.6 }],
  },
];

export const DONKI_GST = [
  {
    gstID: 'GST-1',
    startTime: '2024-05-10T06:00:00Z',
    link: 'https://example.test/gst',
    allKpIndex: [{ kpIndex: 5 }, { kpIndex: 7 }],
  },
];

export const DONKI_SEP = [{ sepID: 'SEP-1' }];

/**
 * SYNTHETIC fixture, shaped like a real DONKI FLR response. Test-only: it is
 * never shipped, never recorded and never served to a child.
 */
export const DONKI_FLR = [
  {
    flrID: '2024-05-10T00:00:00-FLR-001',
    beginTime: '2024-05-10T01:00:00Z',
    peakTime: '2024-05-10T01:15:00Z',
    endTime: '2024-05-10T01:40:00Z',
    classType: 'C2.4',
    sourceLocation: 'N10E20',
    link: 'https://example.test/flr-1',
  },
  {
    flrID: '2024-05-11T00:00:00-FLR-002',
    beginTime: '2024-05-11T05:00:00Z',
    peakTime: '2024-05-11T05:10:00Z',
    classType: 'M1.2',
    sourceLocation: 'N12W04',
    link: 'https://example.test/flr-2',
  },
  {
    flrID: '2024-05-09T00:00:00-FLR-003',
    beginTime: '2024-05-09T22:00:00Z',
    peakTime: '2024-05-09T22:20:00Z',
    classType: 'X1.0',
    sourceLocation: 'S08E10',
    link: 'https://example.test/flr-3',
  },
];

/**
 * SYNTHETIC recording used only by tests (a real one is produced by
 * `bun run record:nasa`). Never shipped, never written to src/content.
 */
export function syntheticRecordedFixture(): RecordedFile {
  return {
    recordedOn: '2024-05-12T00:05:00.000Z',
    window: { start: '2024-04-14', end: '2024-05-12' },
    radlabWindow: { start: '2022-04-01T23:00', end: '2022-04-02T01:05' },
    donki: {
      cme: DONKI_CME,
      gst: DONKI_GST,
      sep: DONKI_SEP,
      flr: DONKI_FLR,
    },
    radlab: RADLAB_RAW,
    osdr: {
      bone: OSDR_RAW,
      radiation: OSDR_RAW,
      immune: OSDR_RAW,
      food: OSDR_RAW,
    },
  };
}

export const RADLAB_RAW = {
  columns: ['timestamp', 'instrument_id', 'absorbed_dose_rate', 'flux'],
  data: [
    ['2022-04-01T23:00:00', 'DosTel1', 4.123, null],
    ['2022-04-01T23:02:13', 'DosTel2', 9.876, 1.234],
    ['2022-04-01T23:05:00', 'DosTel1', 6.5, null],
  ],
};

export const OSDR_RAW = {
  hits: {
    total: 2,
    hits: [
      {
        _id: 'OSD-100',
        _source: {
          Accession: 'OSD-100',
          'Study Title': 'Bone loss during spaceflight',
          organism: ['Mus musculus'],
          'Flight Program': 'International Space Station (ISS)',
          'Study Description': 'A study of bone density loss.',
          'Authoritative Source URL': 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-100',
        },
      },
      {
        _id: 'OSD-101',
        _source: {
          Accession: 'OSD-101',
          'Study Title': 'Muscle maintenance in microgravity',
          organism: 'Homo sapiens',
        },
      },
    ],
  },
};

export interface NasaFetchController {
  fetch: FetchLike;
  counters: Record<string, number>;
  setFailing: (failing: boolean) => void;
  urls: string[];
}

export function createNasaFetch(): NasaFetchController {
  const counters: Record<string, number> = {
    cme: 0,
    gst: 0,
    sep: 0,
    flr: 0,
    radlab: 0,
    osdr: 0,
  };
  const urls: string[] = [];
  let failing = false;

  const fetchImpl: FetchLike = async url => {
    urls.push(url);
    const key = url.includes('DONKI/CME')
      ? 'cme'
      : url.includes('DONKI/GST')
        ? 'gst'
        : url.includes('DONKI/SEP')
          ? 'sep'
          : url.includes('DONKI/FLR')
            ? 'flr'
            : url.includes('radlab')
              ? 'radlab'
              : 'osdr';
    counters[key] += 1;

    if (failing) {
      return new Response('upstream unavailable', { status: 503 });
    }

    switch (key) {
      case 'cme':
        return jsonResponse(DONKI_CME);
      case 'gst':
        return jsonResponse(DONKI_GST);
      case 'sep':
        return jsonResponse(DONKI_SEP);
      case 'flr':
        return jsonResponse(DONKI_FLR);
      case 'radlab':
        return jsonResponse(RADLAB_RAW);
      default:
        return jsonResponse(OSDR_RAW);
    }
  };

  return {
    fetch: fetchImpl,
    counters,
    urls,
    setFailing: (value: boolean) => {
      failing = value;
    },
  };
}

export function expectExactKeys(value: unknown, keys: string[]): void {
  expect(value).toBeTypeOf('object');
  expect(Object.keys(value as Record<string, unknown>).sort()).toEqual([...keys].sort());
}

export function isValidRunId(runId: string): boolean {
  return /^[A-Za-z0-9_-]{6,64}$/.test(runId);
}
