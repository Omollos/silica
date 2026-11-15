import kidJson from '../../content/nasaKid.json';
import type { OsdrTopic, TextPair } from '../../types';

/**
 * Every child-facing NASA sentence in Silica Station comes from this file's
 * fixed templates and is filled only with validated values (a number, a single
 * class letter or a date). Raw NASA free text is never used on child screens.
 */

export const KID_TEXT = kidJson;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const value = vars[key];
    return value === undefined ? whole : String(value);
  });
}

/** "2026-11-12T..." -> "12 November"; "" for anything unparseable. */
export function formatKidDate(iso: string | null | undefined): string {
  if (typeof iso !== 'string' || iso.length < 10) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return '';
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(month) || month < 1 || month > 12) return '';
  if (!Number.isInteger(day) || day < 1 || day > 31) return '';
  return `${day} ${MONTHS[month - 1]}`;
}

export function tierWord(tier: 'mild' | 'medium' | 'strong'): string {
  return tier;
}

export function activityWord(level: 'Quiet' | 'Elevated' | 'Storm Watch'): string {
  if (level === 'Storm Watch') return 'stormy';
  if (level === 'Elevated') return 'a little busy';
  return 'calm';
}

export function kpWord(kpIndex: number): string {
  if (kpIndex >= 6) return 'stormy';
  if (kpIndex >= 5) return 'a little stormy';
  return 'calm';
}

export function badgeLabel(
  kind: 'live' | 'recorded' | 'offline',
  date?: string | null
): string {
  if (kind === 'live') return KID_TEXT.badges.live;
  if (kind === 'recorded') {
    return fill(KID_TEXT.badges.recorded, { date: date ?? '' }).replace(/\s+$/, '');
  }
  return KID_TEXT.badges.offline;
}

export function truthLabel(
  source: 'live' | 'recorded' | 'fallback' | 'unavailable' | null | undefined,
  recordedOn?: string | null
): string | null {
  if (source === 'live') return KID_TEXT.badges.realNasa;
  if (source === 'recorded') {
    const date = formatKidDate(recordedOn);
    if (!date) return null;
    return fill(KID_TEXT.badges.recordedNasa, { date });
  }
  return null;
}

export interface FlareKidInput {
  classType: string;
  classLabel: string;
  tier: 'mild' | 'medium' | 'strong';
  peakTime?: string | null;
  beginTime?: string | null;
}

/** Two short sentences, always built from the templates above. */
export function flareKidText(flare: FlareKidInput): TextPair {
  const date = formatKidDate(flare.peakTime ?? flare.beginTime);
  if (!date || !flare.classLabel || !flare.classType) {
    return {
      short: KID_TEXT.flare.noClass,
      detail: fill(KID_TEXT.flare.detail, {
        classLabel: 'C',
        tierWord: 'mild',
      }),
    };
  }
  return {
    short: fill(KID_TEXT.flare.short, { date, tierWord: tierWord(flare.tier) }),
    detail: fill(KID_TEXT.flare.detail, {
      classLabel: flare.classLabel,
      tierWord: tierWord(flare.tier),
    }),
  };
}

export interface WeatherKidInput {
  activityLevel: 'Quiet' | 'Elevated' | 'Storm Watch';
  cmeCount: number;
  maxCmeSpeedKmS: number;
  maxKpIndex: number;
  sepCount: number;
}

/** One calm line about today's space weather, numbers always with meaning. */
export function weatherKidBrief(weather: WeatherKidInput): string {
  if (weather.activityLevel === 'Quiet' && weather.cmeCount === 0) {
    return KID_TEXT.weather.quiet;
  }
  const head = fill(KID_TEXT.weather.live, {
    cmeCount: Math.max(0, Math.round(weather.cmeCount)),
    activityWord: activityWord(weather.activityLevel),
  });
  if (weather.maxKpIndex >= 5) {
    return `${head} ${fill(KID_TEXT.weather.kp, {
      kpIndex: Math.round(weather.maxKpIndex),
      kpWord: kpWord(weather.maxKpIndex),
    })}`;
  }
  return head;
}

export function radiationKidTakeaway(peak: number): string {
  return `${fill(KID_TEXT.radiation.recorded, {
    peak: Number.isFinite(peak) ? peak : 0,
  })} ${KID_TEXT.radiation.meaning}`;
}

export function radiationWindowLabel(startIso: string): string {
  const date = formatKidDate(startIso);
  if (!date) return KID_TEXT.radiation.offline;
  return fill(KID_TEXT.radiation.window, { date });
}

export function studyKidSummary(topic: OsdrTopic): string {
  return KID_TEXT.studies[topic] ?? KID_TEXT.studies.bone;
}

export function calmLine(
  key: 'weather' | 'unavailable' | 'radiation' | 'studies'
): string {
  if (key === 'radiation') return KID_TEXT.radiation.offline;
  if (key === 'studies') return KID_TEXT.studies.offline;
  if (key === 'unavailable') return KID_TEXT.calm.unavailable;
  return KID_TEXT.calm.weather;
}

export const NASA_ATTRIBUTION = KID_TEXT.attribution;
