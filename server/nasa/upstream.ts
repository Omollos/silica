import type { OsdrTopic } from '../../src/types';
import type { AppConfig } from '../config';
import type { FetchLike } from '../services/nasaCache';

/** Upstream URL builders and one timeout-guarded JSON fetch. */

export const NASA_API_KEY_ENV = 'NASA_API_KEY';

export const TOPIC_QUERIES: Record<OsdrTopic, string> = {
  bone: 'bone muscle atrophy',
  radiation: 'radiation dosimetry spaceflight',
  immune: 'immune stress cold',
  food: 'plant growth hydroponic spaceflight',
};

export type DonkiFeed = 'CME' | 'GST' | 'SEP' | 'FLR';

export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function last28DayWindow(nowMs: number): { start: string; end: string } {
  const end = new Date(nowMs);
  const start = new Date(nowMs - 28 * 24 * 60 * 60 * 1000);
  return { start: isoDay(start), end: isoDay(end) };
}

export function donkiUrl(
  feed: DonkiFeed,
  windowStart: string,
  windowEnd: string,
  apiKey: string
): string {
  const key = encodeURIComponent(apiKey);
  return `https://api.nasa.gov/DONKI/${feed}?startDate=${windowStart}&endDate=${windowEnd}&api_key=${key}`;
}

export function radlabUrl(observedWindow: { start: string; end: string }): string {
  const start = encodeURIComponent(observedWindow.start);
  const end = encodeURIComponent(observedWindow.end);
  return `https://visualization.osdr.nasa.gov/radlab/api/?spacecraft=ISS&instrument=DosTel&timestamp%3E=${start}&timestamp%3C=${end}&absorbed_dose_rate&flux&format=json`;
}

export function osdrUrl(topic: OsdrTopic): string {
  const term = encodeURIComponent(TOPIC_QUERIES[topic]);
  return `https://osdr.nasa.gov/osdr/data/search?term=${term}&size=4&type=cgene`;
}

export function radlabWindow(config: AppConfig): { start: string; end: string } {
  return { start: config.radlabWindowStart, end: config.radlabWindowEnd };
}

export async function fetchJsonWithTimeout(
  fetchImpl: FetchLike,
  url: string,
  timeoutMs: number
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Upstream HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}
