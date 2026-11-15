import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { NasaProvenance, NasaSnapshot, NasaSpaceWeather } from '../../src/types';
import { calmLine } from '../../src/shared/nasa/kidText';
import type { AppConfig } from '../config';
import type { FetchLike } from '../services/nasaCache';
import {
  computeBonus,
  countFlareClasses,
  parseDonkiFlr,
  parseRadlab,
  pickFeaturedFlare,
  summarizeSpaceWeather,
} from './parsers';
import { snapshotFileSchema, type RecordedFile } from './schemas';
import {
  donkiUrl,
  fetchJsonWithTimeout,
  isoDay,
  last28DayWindow,
  radlabUrl,
  radlabWindow,
} from './upstream';

export type SnapshotCacheState = 'hit' | 'miss' | 'recorded' | 'fallback';

export interface SnapshotResult {
  data: NasaSnapshot;
  cache: SnapshotCacheState;
}

export interface NasaSnapshotDeps {
  config: AppConfig;
  nasaFetch: FetchLike;
  now: () => number;
  recorded?: RecordedFile | null;
}

const SNAPSHOT_FILE = /^snapshot-(\d{4}-\d{2}-\d{2})\.json$/;

function snapshotDir(config: AppConfig): string | null {
  const dir = config.nasaSnapshotDir.trim();
  if (dir.length === 0) return null;
  return path.resolve(process.cwd(), dir);
}

function provenanceWindow(start: string, end: string): string {
  return `${start}..${end}`;
}

/** The bonus is always recomputed from the parsed numbers, never trusted blindly. */
function bonusFromWeather(weather: NasaSpaceWeather | null): 0 | 5 | 10 {
  if (!weather) return 0;
  return computeBonus({
    sepCount: weather.sepCount,
    maxKpIndex: weather.maxKpIndex,
    maxCmeSpeedKmS: weather.maxCmeSpeedKmS,
    cmeCount: weather.cmeCount,
  });
}

function snapshotIdFromRecording(recordedOn: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(recordedOn);
  return match ? match[1] : recordedOn.slice(0, 10);
}

/**
 * The daily NASA mission briefing.
 *
 * - Computed once per UTC day, then served unchanged from memory (and from
 *   `data/nasa/snapshot-YYYY-MM-DD.json` when the disk is writable).
 * - Concurrent first requests share one upstream round.
 * - A partial upstream failure keeps the parts that worked and leaves the rest
 *   null; nothing is ever invented.
 * - When every upstream call fails it serves the most recent real recording
 *   (source "recorded", with its real date) or a neutral "unavailable" object.
 */
export class NasaSnapshotService {
  private current: { day: string; snapshot: NasaSnapshot } | null = null;
  private inflight: Promise<SnapshotResult> | null = null;

  constructor(private readonly deps: NasaSnapshotDeps) {}

  async get(): Promise<SnapshotResult> {
    const day = isoDay(new Date(this.deps.now()));
    if (this.current && this.current.day === day) {
      return { data: this.current.snapshot, cache: 'hit' };
    }
    if (this.inflight) return this.inflight;

    const call = this.build(day)
      .then(result => {
        // Only real data is pinned for the day; an "unavailable" result may be
        // retried later (a transient outage should not spoil the whole day).
        if (result.data.source !== 'unavailable') {
          this.current = { day, snapshot: result.data };
        }
        return result;
      })
      .finally(() => {
        this.inflight = null;
      });
    this.inflight = call;
    return call;
  }

  clear(): void {
    this.current = null;
    this.inflight = null;
  }

  private async build(day: string): Promise<SnapshotResult> {
    const saved = await this.readSnapshotFile(day);
    if (saved) return { data: saved, cache: 'hit' };

    const live = await this.buildLive();
    if (live) {
      await this.writeSnapshotFile(day, live);
      return { data: live, cache: 'miss' };
    }

    const previous = await this.readLatestSnapshotFile(day);
    if (previous) {
      return {
        data: {
          ...previous,
          source: 'recorded',
          recordedOn: previous.recordedOn ?? previous.snapshotId,
        },
        cache: 'recorded',
      };
    }

    const fromRecording = this.buildFromRecording(this.deps.recorded ?? null);
    if (fromRecording) return { data: fromRecording, cache: 'recorded' };

    return {
      data: {
        snapshotId: day,
        generatedAt: new Date(this.deps.now()).toISOString(),
        source: 'unavailable',
        bonus: 0,
        spaceWeather: null,
        flare: null,
        radiation: null,
        provenance: [],
        note: calmLine('unavailable'),
      },
      cache: 'fallback',
    };
  }

  private async buildLive(): Promise<NasaSnapshot | null> {
    const { config, nasaFetch, now } = this.deps;
    const window = last28DayWindow(now());
    const radWindow = radlabWindow(config);
    const fetchedAt = new Date(now()).toISOString();
    const timeoutMs = config.nasaFetchTimeoutMs;

    const [cme, gst, sep, flr, radlab] = await Promise.allSettled([
      fetchJsonWithTimeout(
        nasaFetch,
        donkiUrl('CME', window.start, window.end, config.nasaApiKey),
        timeoutMs
      ),
      fetchJsonWithTimeout(
        nasaFetch,
        donkiUrl('GST', window.start, window.end, config.nasaApiKey),
        timeoutMs
      ),
      fetchJsonWithTimeout(
        nasaFetch,
        donkiUrl('SEP', window.start, window.end, config.nasaApiKey),
        timeoutMs
      ),
      fetchJsonWithTimeout(
        nasaFetch,
        donkiUrl('FLR', window.start, window.end, config.nasaApiKey),
        timeoutMs
      ),
      fetchJsonWithTimeout(nasaFetch, radlabUrl(radWindow), config.upstreamLongTimeoutMs),
    ]);

    const cmeOk = cme.status === 'fulfilled';
    const gstOk = gst.status === 'fulfilled';
    const sepOk = sep.status === 'fulfilled';
    const flrOk = flr.status === 'fulfilled';
    const radOk = radlab.status === 'fulfilled';

    const spaceWeather =
      cmeOk && gstOk && sepOk
        ? summarizeSpaceWeather(
            cme.value,
            gst.value,
            sep.value,
            window.start,
            window.end,
            fetchedAt
          )
        : null;

    const flares = flrOk ? parseDonkiFlr(flr.value) : [];
    const flare = pickFeaturedFlare(flares);

    const radiation = radOk
      ? parseRadlab(radlab.value, { observedWindow: radWindow, fetchedAt })
      : null;

    if (!spaceWeather && !flare && !radiation) return null;

    const provenance: NasaProvenance[] = [];
    if (cmeOk || gstOk || sepOk) {
      provenance.push({
        dataset: 'DONKI CME/GST/SEP',
        url: 'https://api.nasa.gov/',
        window: provenanceWindow(window.start, window.end),
        fetchedAt,
      });
    }
    if (flrOk) {
      provenance.push({
        dataset: 'DONKI FLR',
        url: 'https://api.nasa.gov/',
        window: provenanceWindow(window.start, window.end),
        fetchedAt,
      });
    }
    if (radiation) {
      provenance.push({
        dataset: 'OSDR RadLab',
        url: 'https://visualization.osdr.nasa.gov/',
        window: provenanceWindow(radWindow.start, radWindow.end),
        fetchedAt,
      });
    }

    return {
      snapshotId: isoDay(new Date(now())),
      generatedAt: fetchedAt,
      source: 'live',
      bonus: bonusFromWeather(spaceWeather),
      spaceWeather,
      flare,
      radiation,
      provenance,
    };
  }

  /** A snapshot built from the committed real recording (offline demos). */
  buildFromRecording(recorded: RecordedFile | null): NasaSnapshot | null {
    if (!recorded) return null;

    const window = recorded.window;
    const fetchedAt = recorded.recordedOn;
    const radWindow = recorded.radlabWindow ?? window;

    const hasDonki =
      recorded.donki.cme != null && recorded.donki.gst != null && recorded.donki.sep != null;

    const spaceWeather = hasDonki
      ? summarizeSpaceWeather(
          recorded.donki.cme,
          recorded.donki.gst,
          recorded.donki.sep,
          window.start,
          window.end,
          fetchedAt,
          { source: 'recorded', recordedOn: fetchedAt }
        )
      : null;

    const flares = recorded.donki.flr != null ? parseDonkiFlr(recorded.donki.flr) : [];
    const flare = pickFeaturedFlare(flares);

    const radiation = parseRadlab(recorded.radlab ?? null, {
      observedWindow: radWindow,
      fetchedAt,
      source: 'recorded',
      recordedOn: fetchedAt,
    });

    if (!spaceWeather && !flare && !radiation) return null;

    const provenance: NasaProvenance[] = [];
    if (spaceWeather) {
      provenance.push({
        dataset: 'DONKI CME/GST/SEP',
        url: 'https://api.nasa.gov/',
        window: provenanceWindow(window.start, window.end),
        fetchedAt,
      });
    }
    if (flare || recorded.donki.flr != null) {
      provenance.push({
        dataset: 'DONKI FLR',
        url: 'https://api.nasa.gov/',
        window: provenanceWindow(window.start, window.end),
        fetchedAt,
      });
    }
    if (radiation) {
      provenance.push({
        dataset: 'OSDR RadLab',
        url: 'https://visualization.osdr.nasa.gov/',
        window: provenanceWindow(radWindow.start, radWindow.end),
        fetchedAt,
      });
    }

    return {
      snapshotId: snapshotIdFromRecording(fetchedAt),
      generatedAt: fetchedAt,
      source: 'recorded',
      bonus: bonusFromWeather(spaceWeather),
      spaceWeather,
      flare,
      radiation,
      provenance,
      recordedOn: fetchedAt,
    };
  }

  private async readSnapshotFile(day: string): Promise<NasaSnapshot | null> {
    const dir = snapshotDir(this.deps.config);
    if (!dir) return null;
    return this.readSnapshotAt(path.join(dir, `snapshot-${day}.json`));
  }

  private async readLatestSnapshotFile(excludeDay: string): Promise<NasaSnapshot | null> {
    const dir = snapshotDir(this.deps.config);
    if (!dir) return null;
    try {
      const files = await readdir(dir);
      const days = files
        .map(file => SNAPSHOT_FILE.exec(file))
        .filter((match): match is RegExpExecArray => match !== null)
        .map(match => match[1])
        .filter(value => value !== excludeDay)
        .sort()
        .reverse();
      for (const value of days) {
        const snapshot = await this.readSnapshotAt(path.join(dir, `snapshot-${value}.json`));
        if (snapshot) return snapshot;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async readSnapshotAt(filePath: string): Promise<NasaSnapshot | null> {
    try {
      const raw = await readFile(filePath, 'utf8');
      const parsed = snapshotFileSchema.safeParse(JSON.parse(raw));
      return parsed.success ? (parsed.data as NasaSnapshot) : null;
    } catch {
      return null;
    }
  }

  private async writeSnapshotFile(day: string, snapshot: NasaSnapshot): Promise<void> {
    const dir = snapshotDir(this.deps.config);
    if (!dir) return;
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(
        path.join(dir, `snapshot-${day}.json`),
        `${JSON.stringify(snapshot, null, 2)}\n`,
        'utf8'
      );
    } catch {
      // The disk is optional: it is only a warm cache for the next process.
    }
  }
}

/** Exposed for tests and scripts: the same live snapshot without persistence. */
export function buildSnapshotForDay(
  deps: NasaSnapshotDeps
): Promise<{ data: NasaSnapshot; cache: SnapshotCacheState }> {
  return new NasaSnapshotService({ ...deps, config: { ...deps.config } }).get();
}

/** Bonus is always derived from real data; this is the only game-affecting value. */
export function snapshotBonus(snapshot: NasaSnapshot): 0 | 5 | 10 {
  return snapshot.spaceWeather
    ? computeBonus({
        sepCount: snapshot.spaceWeather.sepCount,
        maxKpIndex: snapshot.spaceWeather.maxKpIndex,
        maxCmeSpeedKmS: snapshot.spaceWeather.maxCmeSpeedKmS,
        cmeCount: snapshot.spaceWeather.cmeCount,
      })
    : 0;
}

/** Counts for the Science Library flare card (C/M/X badges). */
export function flareCounts(snapshot: NasaSnapshot): { c: number; m: number; x: number } {
  return countFlareClasses(
    snapshot.provenance.some(entry => entry.dataset === 'DONKI FLR') && snapshot.flare
      ? [snapshot.flare]
      : []
  );
}
