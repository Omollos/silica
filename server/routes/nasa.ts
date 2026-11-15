import { Router } from 'express';
import type { Request, Response } from 'express';
import type {
  NasaFlareWindow,
  NasaSnapshot,
  NasaSpaceWeather,
  OsdrResponse,
  OsdrTopic,
  RadLabSummary,
} from '../../src/types';
import type { AppConfig } from '../config';
import { asyncHandler } from '../errors';
import { createRateLimiter, type RateLimits } from '../middleware/rateLimit';
import {
  countFlareClasses,
  neutralFlareWindow,
  neutralOsdr,
  neutralRadlab,
  neutralSpaceWeather,
  parseDonkiFlr,
  parseOsdr,
  parseRadlab,
  pickFeaturedFlare,
  summarizeSpaceWeather,
} from '../nasa/parsers';
import { readRecordedFile } from '../nasa/recorded';
import type { RecordedFile } from '../nasa/schemas';
import { NasaSnapshotService, type SnapshotResult } from '../nasa/snapshot';
import {
  donkiUrl,
  fetchJsonWithTimeout,
  last28DayWindow,
  osdrUrl,
  radlabUrl,
  radlabWindow,
  TOPIC_QUERIES,
} from '../nasa/upstream';
import { NasaCache, type CachedResult, type FetchLike } from '../services/nasaCache';

/** Space weather and flares are refreshed every 30 minutes for the library. */
const SPACE_WEATHER_TTL_MS = 30 * 60 * 1000;
const FLARE_TTL_MS = 30 * 60 * 1000;
/** RadLab is a fixed historical recording, so a day of cache is plenty. */
const RADLAB_TTL_MS = 24 * 60 * 60 * 1000;
const OSDR_TTL_MS = 6 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Recorded fallbacks (real data saved by `bun run record:nasa`)
// ---------------------------------------------------------------------------

function recordedSpaceWeather(
  recorded: RecordedFile | null
): NasaSpaceWeather | null {
  if (!recorded) return null;
  const { cme, gst, sep } = recorded.donki;
  if (cme == null || gst == null || sep == null) return null;
  return summarizeSpaceWeather(
    cme,
    gst,
    sep,
    recorded.window.start,
    recorded.window.end,
    recorded.recordedOn,
    { source: 'recorded', recordedOn: recorded.recordedOn }
  );
}

function recordedRadlab(recorded: RecordedFile | null): RadLabSummary | null {
  if (!recorded || recorded.radlab == null) return null;
  return parseRadlab(recorded.radlab, {
    observedWindow: recorded.radlabWindow ?? recorded.window,
    fetchedAt: recorded.recordedOn,
    source: 'recorded',
    recordedOn: recorded.recordedOn,
  });
}

function recordedOsdr(
  recorded: RecordedFile | null,
  topic: OsdrTopic
): OsdrResponse | null {
  if (!recorded) return null;
  const raw = recorded.osdr?.[topic];
  if (raw == null) return null;
  const parsed = parseOsdr(raw, topic, {
    source: 'recorded',
    recordedOn: recorded.recordedOn,
    fetchedAt: recorded.recordedOn,
  });
  return parsed.totalHits > 0 && parsed.studies.length > 0 ? parsed : null;
}

function recordedFlareWindow(recorded: RecordedFile | null): NasaFlareWindow | null {
  if (!recorded || recorded.donki.flr == null) return null;
  const flares = parseDonkiFlr(recorded.donki.flr);
  return {
    source: 'recorded',
    windowStart: recorded.window.start,
    windowEnd: recorded.window.end,
    fetchedAt: recorded.recordedOn,
    featured: pickFeaturedFlare(flares),
    counts: countFlareClasses(flares),
    flares: flares.slice(-12),
    recordedOn: recorded.recordedOn,
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export interface NasaRouterOptions {
  config: AppConfig;
  nasaFetch: FetchLike;
  now: () => number;
  cache?: NasaCache;
  snapshot?: NasaSnapshotService;
  recorded?: RecordedFile | null;
  rateLimits: RateLimits;
}

function sendCached(res: Response, result: CachedResult<unknown>): void {
  const data = result.data as { source?: string } | null;
  const cacheState =
    result.cache === 'fallback' && data?.source === 'recorded' ? 'recorded' : result.cache;
  res.setHeader('X-Cache', cacheState);
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json(result.data);
}

function sendSnapshot(res: Response, result: SnapshotResult): void {
  res.setHeader('X-Cache', result.cache);
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json(result.data as NasaSnapshot);
}

export function createNasaRouter(options: NasaRouterOptions): Router {
  const router = Router();
  const cache = options.cache ?? new NasaCache(options.now);
  const { config, nasaFetch, now } = options;
  const recorded = options.recorded === undefined ? readRecordedFile() : options.recorded;
  const snapshotService =
    options.snapshot ??
    new NasaSnapshotService({ config, nasaFetch, now, recorded });

  router.use(
    '/api/nasa',
    createRateLimiter({
      windowMs: options.rateLimits.windowMs,
      limit: options.rateLimits.nasa,
      enabled: options.rateLimits.enabled,
    })
  );

  /** Today's NASA mission briefing: identical for every player all UTC day. */
  router.get(
    '/api/nasa/snapshot',
    asyncHandler(async (_req: Request, res: Response) => {
      const result = await snapshotService.get();
      sendSnapshot(res, result);
    })
  );

  /**
   * Space weather (CME, GST, SEP). Old fields are unchanged; recordedOn and
   * note are optional additions so the UI can label recorded data truthfully.
   */
  router.get(
    '/api/nasa/space-weather',
    asyncHandler(async (_req: Request, res: Response) => {
      const window = last28DayWindow(now());
      const fetchedAt = new Date(now()).toISOString();

      const result = await cache.get<NasaSpaceWeather>(
        'donki',
        SPACE_WEATHER_TTL_MS,
        async () => {
          const [cme, gst, sep] = await Promise.all([
            fetchJsonWithTimeout(
              nasaFetch,
              donkiUrl('CME', window.start, window.end, config.nasaApiKey),
              config.nasaFetchTimeoutMs
            ),
            fetchJsonWithTimeout(
              nasaFetch,
              donkiUrl('GST', window.start, window.end, config.nasaApiKey),
              config.nasaFetchTimeoutMs
            ),
            fetchJsonWithTimeout(
              nasaFetch,
              donkiUrl('SEP', window.start, window.end, config.nasaApiKey),
              config.nasaFetchTimeoutMs
            ),
          ]);
          return summarizeSpaceWeather(cme, gst, sep, window.start, window.end, fetchedAt);
        },
        () =>
          recordedSpaceWeather(recorded) ??
          neutralSpaceWeather(window.start, window.end, fetchedAt)
      );

      sendCached(res, result);
    })
  );

  /** Real DONKI solar flares (presentation only: they never change damage). */
  router.get(
    '/api/nasa/flares',
    asyncHandler(async (_req: Request, res: Response) => {
      const window = last28DayWindow(now());
      const fetchedAt = new Date(now()).toISOString();

      const result = await cache.get<NasaFlareWindow>(
        'flr',
        FLARE_TTL_MS,
        async () => {
          const raw = await fetchJsonWithTimeout(
            nasaFetch,
            donkiUrl('FLR', window.start, window.end, config.nasaApiKey),
            config.nasaFetchTimeoutMs
          );
          const flares = parseDonkiFlr(raw);
          return {
            source: 'live' as const,
            windowStart: window.start,
            windowEnd: window.end,
            fetchedAt,
            featured: pickFeaturedFlare(flares),
            counts: countFlareClasses(flares),
            flares: flares.slice(-12),
          };
        },
        () =>
          recordedFlareWindow(recorded) ??
          neutralFlareWindow(window.start, window.end, fetchedAt)
      );

      sendCached(res, result);
    })
  );

  /** RadLab ISS dosimetry. This is a fixed real recording, never a live read. */
  router.get(
    '/api/nasa/radlab',
    asyncHandler(async (_req: Request, res: Response) => {
      const window = radlabWindow(config);
      const fetchedAt = new Date(now()).toISOString();

      const result = await cache.get<RadLabSummary>(
        'radlab',
        RADLAB_TTL_MS,
        async () => {
          const raw = await fetchJsonWithTimeout(
            nasaFetch,
            radlabUrl(window),
            config.upstreamLongTimeoutMs
          );
          const parsed = parseRadlab(raw, { observedWindow: window, fetchedAt });
          if (!parsed) throw new Error('No RadLab rows returned');
          return parsed;
        },
        () => recordedRadlab(recorded) ?? neutralRadlab(window, fetchedAt)
      );

      sendCached(res, result);
    })
  );

  router.get(
    '/api/nasa/osdr',
    asyncHandler(async (req: Request, res: Response) => {
      const rawTopic = String(req.query.topic ?? 'bone').toLowerCase();
      const topic: OsdrTopic = Object.prototype.hasOwnProperty.call(TOPIC_QUERIES, rawTopic)
        ? (rawTopic as OsdrTopic)
        : 'bone';
      const fetchedAt = new Date(now()).toISOString();

      const result = await cache.get<OsdrResponse>(
        `osdr:${topic}`,
        OSDR_TTL_MS,
        async () => {
          const raw = await fetchJsonWithTimeout(
            nasaFetch,
            osdrUrl(topic),
            config.nasaFetchTimeoutMs
          );
          return parseOsdr(raw, topic, { fetchedAt });
        },
        () => recordedOsdr(recorded, topic) ?? neutralOsdr(topic, fetchedAt)
      );

      sendCached(res, result);
    })
  );

  return router;
}

