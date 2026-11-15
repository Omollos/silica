import type {
  NasaFlare,
  NasaFlareWindow,
  NasaSpaceWeather,
  OsdrResponse,
  OsdrStudy,
  OsdrTopic,
  RadLabSample,
  RadLabSummary,
} from '../../src/types';
import {
  calmLine,
  flareKidText,
  radiationKidTakeaway,
  weatherKidBrief,
} from '../../src/shared/nasa/kidText';
import {
  donkiCmeItemSchema,
  donkiFlrItemSchema,
  donkiGstItemSchema,
  donkiSepItemSchema,
  osdrSearchSchema,
  radlabRawSchema,
} from './schemas';

/**
 * Pure parsing and summarising. No network, no clock, no Express: every
 * function here is unit-testable with a captured fixture, and every function
 * drops anything it cannot prove instead of inventing a value.
 */

export const DONKI_LANDING_URL = 'https://ccmc.gsfc.nasa.gov/tools/DONKI/';
export const RADLAB_PORTAL_URL = 'https://visualization.osdr.nasa.gov/';
export const OSDR_STUDY_BASE_URL = 'https://osdr.nasa.gov/bio/repo/data/studies/';

const MAX_ITEMS = 60;

/** Removes markup and tags from any NASA free text before it is stored. */
export function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Clean, bounded text from an unknown value. Returns null when unusable. */
export function cleanText(value: unknown, maxLen: number): string | null {
  let raw: string | null = null;
  if (typeof value === 'string') raw = value;
  else if (typeof value === 'number' && Number.isFinite(value)) raw = String(value);
  else if (Array.isArray(value)) {
    const first = value.find(item => typeof item === 'string');
    if (typeof first === 'string') raw = first;
  }
  if (raw === null) return null;
  const clean = stripHtml(raw);
  if (clean.length === 0) return null;
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1).trim()}…`;
}

/** Only absolute https links survive; everything else uses a stable page. */
export function safeLink(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return fallback;
  }
  if (url.protocol !== 'https:') return fallback;
  // The legacy DONKI deep-link host no longer resolves; send people to DONKI.
  if (url.hostname === 'kauai.ccmc.gsfc.nasa.gov') return DONKI_LANDING_URL;
  if (url.href.length > 2048) return fallback;
  return url.href;
}

function asArray(raw: unknown): unknown[] {
  return Array.isArray(raw) ? raw.slice(0, MAX_ITEMS) : [];
}

function isValidIsoish(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?/.test(value);
}

function byRecency<T extends { startTime: string }>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items.reduce((latest, item) =>
    item.startTime.localeCompare(latest.startTime) >= 0 ? item : latest
  );
}

// ---------------------------------------------------------------------------
// DONKI: coronal mass ejections, geomagnetic storms, solar particle events
// ---------------------------------------------------------------------------

export interface ParsedCme {
  id: string;
  startTime: string;
  speedKmS: number | null;
  note: string;
  link: string;
}

export function parseDonkiCme(raw: unknown): {
  items: ParsedCme[];
  count: number;
  maxSpeedKmS: number;
} {
  const items: ParsedCme[] = [];
  for (const candidate of asArray(raw)) {
    const parsed = donkiCmeItemSchema.safeParse(candidate);
    if (!parsed.success) continue;
    const item = parsed.data;
    const startTime = cleanText(item.startTime, 40);
    if (!startTime || !isValidIsoish(startTime)) continue;

    const analyses = Array.isArray(item.cmeAnalyses) ? item.cmeAnalyses : [];
    const accurate = analyses.filter(analysis => analysis?.isMostAccurate === true);
    const candidates = accurate.length > 0 ? accurate : analyses;
    let speed: number | null = null;
    for (const analysis of candidates) {
      const value = analysis?.speed;
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        if (speed === null || value > speed) speed = Math.round(value);
      }
    }

    items.push({
      id: cleanText(item.activityID, 128) ?? `CME-${startTime}`,
      startTime,
      speedKmS: speed,
      note: cleanText(item.note, 180) ?? '',
      link: safeLink(item.link, DONKI_LANDING_URL),
    });
  }

  const maxSpeedKmS = items.reduce(
    (max, item) => (item.speedKmS !== null && item.speedKmS > max ? item.speedKmS : max),
    0
  );
  return { items, count: items.length, maxSpeedKmS };
}

export interface ParsedGst {
  id: string;
  startTime: string;
  kpIndex: number;
  link: string;
}

export function parseDonkiGst(raw: unknown): {
  items: ParsedGst[];
  count: number;
  maxKpIndex: number;
} {
  const items: ParsedGst[] = [];
  for (const candidate of asArray(raw)) {
    const parsed = donkiGstItemSchema.safeParse(candidate);
    if (!parsed.success) continue;
    const item = parsed.data;
    const startTime = cleanText(item.startTime, 40);
    if (!startTime || !isValidIsoish(startTime)) continue;

    const kpIndexes = Array.isArray(item.allKpIndex) ? item.allKpIndex : [];
    let topKp = 0;
    for (const entry of kpIndexes) {
      const value = entry?.kpIndex;
      if (typeof value === 'number' && Number.isFinite(value) && value > topKp) {
        topKp = Math.max(0, Math.min(9, value));
      }
    }
    items.push({
      id: cleanText(item.gstID, 128) ?? `GST-${startTime}`,
      startTime,
      kpIndex: topKp,
      link: safeLink(item.link, DONKI_LANDING_URL),
    });
  }

  const maxKpIndex = items.reduce((max, item) => Math.max(max, item.kpIndex), 0);
  return { items, count: items.length, maxKpIndex };
}

export function parseDonkiSep(raw: unknown): { count: number } {
  let count = 0;
  for (const candidate of asArray(raw)) {
    const parsed = donkiSepItemSchema.safeParse(candidate);
    if (!parsed.success) continue;
    const time = cleanText(parsed.data.eventTime, 40);
    const id = cleanText(parsed.data.sepID, 128);
    // A record must at least identify itself or carry a timestamp.
    if (!id && !time) continue;
    count += 1;
  }
  return { count };
}

// ---------------------------------------------------------------------------
// DONKI: solar flares (FLR) -- presentation only, never damage
// ---------------------------------------------------------------------------

export function flareClassLabel(classType: string): string | null {
  const match = /^([ABCMX])/i.exec(classType.trim());
  if (!match) return null;
  return match[1].toUpperCase();
}

export function flareTier(classLabel: string): 'mild' | 'medium' | 'strong' {
  if (classLabel === 'X') return 'strong';
  if (classLabel === 'M') return 'medium';
  return 'mild';
}

export function parseDonkiFlr(raw: unknown): NasaFlare[] {
  const flares: NasaFlare[] = [];
  const seen = new Set<string>();

  for (const candidate of asArray(raw)) {
    const parsed = donkiFlrItemSchema.safeParse(candidate);
    if (!parsed.success) continue;
    const item = parsed.data;
    const beginTime = cleanText(item.beginTime, 40);
    const classType = cleanText(item.classType, 32);
    if (!beginTime || !isValidIsoish(beginTime)) continue;
    if (!classType) continue;
    const classLabel = flareClassLabel(classType);
    if (!classLabel) continue;

    const id = cleanText(item.flrID, 128) ?? `FLR-${beginTime}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const tier = flareTier(classLabel);
    const peakTime = cleanText(item.peakTime, 40);
    const flare: NasaFlare = {
      id,
      beginTime,
      peakTime,
      classType: classType.toUpperCase(),
      classLabel,
      tier,
      sourceLocation: cleanText(item.sourceLocation, 64),
      link: safeLink(item.link, DONKI_LANDING_URL),
      kid: { short: '', detail: '' },
    };
    flare.kid = flareKidText({
      classType: flare.classType,
      classLabel,
      tier,
      peakTime,
      beginTime,
    });
    flares.push(flare);
  }

  return flares.sort((a, b) => a.beginTime.localeCompare(b.beginTime));
}

const CLASS_RANK: Record<string, number> = { A: 0, B: 1, C: 2, M: 3, X: 4 };

/** Strongest class wins (X over M over C); ties go to the most recent flare. */
export function pickFeaturedFlare(flares: NasaFlare[]): NasaFlare | null {
  let best: NasaFlare | null = null;
  for (const flare of flares) {
    if (!best) {
      best = flare;
      continue;
    }
    const rank = CLASS_RANK[flare.classLabel] ?? -1;
    const bestRank = CLASS_RANK[best.classLabel] ?? -1;
    if (rank > bestRank) {
      best = flare;
    } else if (rank === bestRank) {
      const flareTime = flare.peakTime ?? flare.beginTime;
      const bestTime = best.peakTime ?? best.beginTime;
      if (flareTime.localeCompare(bestTime) >= 0) best = flare;
    }
  }
  return best;
}

export function countFlareClasses(flares: NasaFlare[]): { c: number; m: number; x: number } {
  const counts = { c: 0, m: 0, x: 0 };
  for (const flare of flares) {
    if (flare.classLabel === 'X') counts.x += 1;
    else if (flare.classLabel === 'M') counts.m += 1;
    else if (flare.classLabel === 'C') counts.c += 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Space weather summary and the unchanged bonus thresholds
// ---------------------------------------------------------------------------

export interface BonusInput {
  sepCount: number;
  maxKpIndex: number;
  maxCmeSpeedKmS: number;
  cmeCount: number;
}

/**
 * The existing thresholds, unchanged:
 *   Storm Watch -> 10, Elevated -> 5, Quiet -> 0.
 */
export function computeBonus(input: BonusInput): 0 | 5 | 10 {
  if (input.sepCount > 0 || input.maxKpIndex >= 6 || input.maxCmeSpeedKmS >= 1000) return 10;
  if (input.maxKpIndex >= 5 || input.maxCmeSpeedKmS >= 650 || input.cmeCount >= 12) return 5;
  return 0;
}

export function activityLevelFor(input: BonusInput): 'Quiet' | 'Elevated' | 'Storm Watch' {
  const bonus = computeBonus(input);
  if (bonus === 10) return 'Storm Watch';
  if (bonus === 5) return 'Elevated';
  return 'Quiet';
}

export interface ParseSourceOptions {
  source?: 'live' | 'recorded';
  recordedOn?: string;
  note?: string;
}

export function summarizeSpaceWeather(
  cmeRaw: unknown,
  gstRaw: unknown,
  sepRaw: unknown,
  windowStart: string,
  windowEnd: string,
  fetchedAt: string,
  options: ParseSourceOptions = {}
): NasaSpaceWeather {
  const cme = parseDonkiCme(cmeRaw);
  const gst = parseDonkiGst(gstRaw);
  const sep = parseDonkiSep(sepRaw);

  const input: BonusInput = {
    sepCount: sep.count,
    maxKpIndex: gst.maxKpIndex,
    maxCmeSpeedKmS: cme.maxSpeedKmS,
    cmeCount: cme.count,
  };
  const activityLevel = activityLevelFor(input);
  const latestCme = byRecency(cme.items);
  const latestGst = byRecency(gst.items);

  return {
    source: options.source ?? 'live',
    windowStart,
    windowEnd,
    fetchedAt,
    activityLevel,
    recommendedFlareBonus: computeBonus(input),
    cmeCount: cme.count,
    maxCmeSpeedKmS: cme.maxSpeedKmS,
    gstCount: gst.count,
    maxKpIndex: gst.maxKpIndex,
    sepCount: sep.count,
    latestCme: latestCme
      ? {
          id: latestCme.id,
          startTime: latestCme.startTime,
          speedKmS: latestCme.speedKmS,
          note: latestCme.note,
          link: latestCme.link,
        }
      : null,
    latestGst: latestGst
      ? {
          id: latestGst.id,
          startTime: latestGst.startTime,
          kpIndex: latestGst.kpIndex,
          link: latestGst.link,
        }
      : null,
    kidBrief: weatherKidBrief({
      activityLevel,
      cmeCount: cme.count,
      maxCmeSpeedKmS: cme.maxSpeedKmS,
      maxKpIndex: gst.maxKpIndex,
      sepCount: sep.count,
    }),
    ...(options.recordedOn ? { recordedOn: options.recordedOn } : {}),
    ...(options.note ? { note: options.note } : {}),
  };
}

// ---------------------------------------------------------------------------
// OSDR RadLab dosimetry (a fixed recording, never a live reading)
// ---------------------------------------------------------------------------

export interface RadLabParseOptions extends ParseSourceOptions {
  observedWindow: { start: string; end: string };
  fetchedAt: string;
}

export function parseRadlab(
  raw: unknown,
  options: RadLabParseOptions
): RadLabSummary | null {
  const parsed = radlabRawSchema.safeParse(raw);
  if (!parsed.success) return null;

  const columns = parsed.data.columns;
  const rows = parsed.data.data;
  const timestampIndex = columns.indexOf('timestamp');
  const instrumentIndex = columns.indexOf('instrument_id');
  const doseIndex = columns.indexOf('absorbed_dose_rate');
  const fluxIndex = columns.indexOf('flux');
  if (doseIndex < 0) return null;

  const readings: RadLabSample[] = [];
  for (const row of rows.slice(0, 5000)) {
    if (!Array.isArray(row)) continue;
    const dose = row[doseIndex];
    if (typeof dose !== 'number' || !Number.isFinite(dose) || dose < 0) continue;
    const timestamp = timestampIndex >= 0 ? cleanText(row[timestampIndex], 40) : null;
    if (!timestamp) continue;
    const instrument =
      instrumentIndex >= 0 ? cleanText(row[instrumentIndex], 64) : null;
    const flux = fluxIndex >= 0 ? row[fluxIndex] : null;
    readings.push({
      timestamp,
      instrumentId: instrument ?? 'DosTel',
      absorbedDoseRate: Number(dose.toFixed(2)),
      flux:
        typeof flux === 'number' && Number.isFinite(flux)
          ? Number(flux.toFixed(2))
          : null,
    });
  }

  if (readings.length === 0) return null;

  const doses = readings.map(reading => reading.absorbedDoseRate);
  const sum = doses.reduce((total, value) => total + value, 0);
  const avgDoseMicroGyHr = Number((sum / doses.length).toFixed(2));
  const minDoseMicroGyHr = Number(Math.min(...doses).toFixed(2));
  const peakDoseMicroGyHr = Number(Math.max(...doses).toFixed(2));

  const step = Math.max(1, Math.floor(readings.length / 6));
  const samples = readings.filter((_, index) => index % step === 0).slice(0, 6);
  const instruments = Array.from(new Set(readings.map(reading => reading.instrumentId)))
    .slice(0, 8);

  return {
    source: options.source ?? 'live',
    spacecraft: 'International Space Station (ISS)',
    instruments,
    sampleCount: readings.length,
    avgDoseMicroGyHr,
    minDoseMicroGyHr,
    peakDoseMicroGyHr,
    samples,
    kidTakeaway: radiationKidTakeaway(peakDoseMicroGyHr),
    portalUrl: RADLAB_PORTAL_URL,
    observedWindow: {
      start: options.observedWindow.start,
      end: options.observedWindow.end,
    },
    fetchedAt: options.fetchedAt,
    ...(options.recordedOn ? { recordedOn: options.recordedOn } : {}),
    ...(options.note ? { note: options.note } : {}),
  };
}

// ---------------------------------------------------------------------------
// OSDR study search
// ---------------------------------------------------------------------------

function studyUrl(rawUrl: unknown, accession: string): string {
  if (typeof rawUrl === 'string' && /^https:\/\//i.test(rawUrl.trim())) {
    return safeLink(rawUrl, `${OSDR_STUDY_BASE_URL}${accession}`);
  }
  return `${OSDR_STUDY_BASE_URL}${accession}`;
}

export function parseOsdr(
  raw: unknown,
  topic: OsdrTopic,
  options: ParseSourceOptions & { fetchedAt: string }
): OsdrResponse {
  const parsed = osdrSearchSchema.safeParse(raw);
  const studies: OsdrStudy[] = [];
  const seen = new Set<string>();

  if (parsed.success) {
    const hits = parsed.data.hits;
    const hitList = Array.isArray(hits?.hits) ? hits.hits : [];
    for (const hit of hitList) {
      const source = hit._source ?? {};
      const accession = cleanText(source['Accession'], 64) ?? cleanText(hit._id, 64);
      if (!accession || !/^[A-Za-z0-9._-]+$/.test(accession)) continue;
      const title = cleanText(source['Study Title'], 300);
      if (!title) continue;
      if (seen.has(accession)) continue;
      seen.add(accession);

      const summary =
        cleanText(source['Study Description'], 190) ??
        cleanText(source['Study Protocol Description'], 190) ??
        '';

      studies.push({
        accession,
        title,
        organism: cleanText(source['organism'], 120) ?? 'Spaceflight study',
        flightProgram:
          cleanText(source['Flight Program'], 120) ??
          cleanText(source['Space Program'], 120) ??
          'NASA',
        summary,
        url: studyUrl(source['Authoritative Source URL'], accession),
      });
    }
  }

  const rawTotal = parsed.success ? parsed.data.hits?.total : undefined;
  const totalHits =
    typeof rawTotal === 'number' && Number.isFinite(rawTotal)
      ? Math.max(0, Math.round(rawTotal))
      : typeof rawTotal === 'object' && rawTotal !== null && 'value' in rawTotal
        ? Math.max(0, Math.round(Number((rawTotal as { value: number }).value) || 0))
        : studies.length;

  return {
    source: options.source ?? 'live',
    topic,
    totalHits: Math.max(totalHits, studies.length),
    studies: studies.slice(0, 6),
    fetchedAt: options.fetchedAt,
    ...(options.recordedOn ? { recordedOn: options.recordedOn } : {}),
    ...(options.note ? { note: options.note } : {}),
  };
}

// ---------------------------------------------------------------------------
// Honest fallbacks (never a made-up number)
// ---------------------------------------------------------------------------

export function neutralSpaceWeather(
  windowStart: string,
  windowEnd: string,
  fetchedAt: string
): NasaSpaceWeather {
  return {
    source: 'fallback',
    windowStart,
    windowEnd,
    fetchedAt,
    activityLevel: 'Quiet',
    recommendedFlareBonus: 0,
    cmeCount: 0,
    maxCmeSpeedKmS: 0,
    gstCount: 0,
    maxKpIndex: 0,
    sepCount: 0,
    latestCme: null,
    latestGst: null,
    kidBrief: calmLine('weather'),
    note: calmLine('weather'),
  };
}

export function neutralFlareWindow(
  windowStart: string,
  windowEnd: string,
  fetchedAt: string
): NasaFlareWindow {
  return {
    source: 'fallback',
    windowStart,
    windowEnd,
    fetchedAt,
    featured: null,
    counts: { c: 0, m: 0, x: 0 },
    flares: [],
    note: calmLine('weather'),
  };
}

export function neutralRadlab(
  observedWindow: { start: string; end: string },
  fetchedAt: string
): RadLabSummary {
  return {
    source: 'fallback',
    spacecraft: 'International Space Station (ISS)',
    instruments: [],
    sampleCount: 0,
    avgDoseMicroGyHr: 0,
    minDoseMicroGyHr: 0,
    peakDoseMicroGyHr: 0,
    samples: [],
    kidTakeaway: calmLine('radiation'),
    portalUrl: RADLAB_PORTAL_URL,
    observedWindow,
    fetchedAt,
    note: calmLine('radiation'),
  };
}

export function neutralOsdr(topic: OsdrTopic, fetchedAt: string): OsdrResponse {
  return {
    source: 'fallback',
    topic,
    totalHits: 0,
    studies: [],
    fetchedAt,
    note: calmLine('studies'),
  };
}
