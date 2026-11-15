import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { NasaSnapshotService } from '../nasa/snapshot';
import type { FetchLike } from '../services/nasaCache';
import { createNasaFetch, syntheticRecordedFixture, testConfig } from './helpers';

const DAY_15 = Date.UTC(2026, 10, 15, 0, 2, 11);
const HOUR = 60 * 60 * 1000;
const tempDirs: string[] = [];

async function tempSnapshotDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'silica-nasa-'));
  tempDirs.push(dir);
  return dir;
}

afterAll(async () => {
  await Promise.all(tempDirs.map(dir => rm(dir, { recursive: true, force: true })));
});

function failingFetch(base: FetchLike, match: string): FetchLike {
  return (url, init) =>
    url.includes(match)
      ? Promise.resolve(new Response('upstream unavailable', { status: 503 }))
      : base(url, init);
}

describe('daily NASA snapshot', () => {
  it('returns the identical object for the whole UTC day and recomputes the next day', async () => {
    const nasa = createNasaFetch();
    let clock = DAY_15;
    const service = new NasaSnapshotService({
      config: testConfig(),
      nasaFetch: nasa.fetch,
      now: () => clock,
      recorded: null,
    });

    const first = await service.get();
    expect(first.cache).toBe('miss');
    expect(first.data.source).toBe('live');
    expect(first.data.snapshotId).toBe('2026-11-15');
    expect(first.data.bonus).toBe(10);
    expect(first.data.spaceWeather?.activityLevel).toBe('Storm Watch');
    expect(first.data.flare?.classLabel).toBe('X');
    expect(first.data.radiation?.sampleCount).toBe(3);
    expect(first.data.provenance.map(entry => entry.dataset)).toEqual([
      'DONKI CME/GST/SEP',
      'DONKI FLR',
      'OSDR RadLab',
    ]);

    clock = DAY_15 + 6 * HOUR;
    const second = await service.get();
    expect(second.cache).toBe('hit');
    expect(second.data).toEqual(first.data);
    expect(nasa.counters.cme).toBe(1);
    expect(nasa.counters.flr).toBe(1);

    clock = Date.UTC(2026, 10, 16, 0, 1, 0);
    const third = await service.get();
    expect(third.cache).toBe('miss');
    expect(third.data.snapshotId).toBe('2026-11-16');
    expect(third.data.generatedAt).not.toBe(first.data.generatedAt);
    expect(nasa.counters.cme).toBe(2);
  });

  it('coalesces concurrent first requests into one upstream round', async () => {
    const nasa = createNasaFetch();
    const service = new NasaSnapshotService({
      config: testConfig(),
      nasaFetch: nasa.fetch,
      now: () => DAY_15,
      recorded: null,
    });
    const results = await Promise.all(Array.from({ length: 5 }, () => service.get()));
    expect(results.every(result => result.data.snapshotId === '2026-11-15')).toBe(true);
    expect(nasa.counters.cme).toBe(1);
    expect(nasa.counters.radlab).toBe(1);
  });

  it('keeps the parts that worked when only the flare feed fails', async () => {
    const nasa = createNasaFetch();
    const service = new NasaSnapshotService({
      config: testConfig(),
      nasaFetch: failingFetch(nasa.fetch, 'DONKI/FLR'),
      now: () => DAY_15,
      recorded: null,
    });
    const { data } = await service.get();
    expect(data.source).toBe('live');
    expect(data.spaceWeather).not.toBeNull();
    expect(data.flare).toBeNull();
    expect(data.radiation).not.toBeNull();
    expect(data.provenance.map(entry => entry.dataset)).toEqual([
      'DONKI CME/GST/SEP',
      'OSDR RadLab',
    ]);
  });

  it('leaves space weather null and the bonus at 0 when a space-weather feed fails', async () => {
    const nasa = createNasaFetch();
    const service = new NasaSnapshotService({
      config: testConfig(),
      nasaFetch: failingFetch(nasa.fetch, 'DONKI/CME'),
      now: () => DAY_15,
      recorded: null,
    });
    const { data } = await service.get();
    expect(data.source).toBe('live');
    expect(data.spaceWeather).toBeNull();
    expect(data.bonus).toBe(0);
    expect(data.flare?.classLabel).toBe('X');
    // The space-weather part is null, so its provenance entry stays and the
    // missing feed is visible through spaceWeather being null.
    expect(data.provenance.map(entry => entry.dataset)).toEqual([
      'DONKI CME/GST/SEP',
      'DONKI FLR',
      'OSDR RadLab',
    ]);
  });

  it('serves the real recording with its own date when NASA is entirely down', async () => {
    const nasa = createNasaFetch();
    nasa.setFailing(true);
    const service = new NasaSnapshotService({
      config: testConfig(),
      nasaFetch: nasa.fetch,
      now: () => DAY_15,
      recorded: syntheticRecordedFixture(),
    });
    const { data, cache } = await service.get();
    expect(cache).toBe('recorded');
    expect(data.source).toBe('recorded');
    expect(data.snapshotId).toBe('2024-05-12');
    expect(data.bonus).toBe(10);
    expect(data.spaceWeather?.source).toBe('recorded');
    expect(data.flare?.classLabel).toBe('X');
    expect(data.radiation?.observedWindow.start).toBe('2022-04-01T23:00');
  });

  it('is honestly unavailable (bonus 0, nothing invented) with no recording at all', async () => {
    const nasa = createNasaFetch();
    nasa.setFailing(true);
    const service = new NasaSnapshotService({
      config: testConfig(),
      nasaFetch: nasa.fetch,
      now: () => DAY_15,
      recorded: null,
    });
    const { data, cache } = await service.get();
    expect(cache).toBe('fallback');
    expect(data.source).toBe('unavailable');
    expect(data.bonus).toBe(0);
    expect(data.spaceWeather).toBeNull();
    expect(data.flare).toBeNull();
    expect(data.radiation).toBeNull();
    expect(data.provenance).toEqual([]);
    expect(data.snapshotId).toBe('2026-11-15');
    expect(data.note).toBeTruthy();
  });

  it('persists the day to disk and reuses it after a restart', async () => {
    const dir = await tempSnapshotDir();
    const config = testConfig({ NASA_SNAPSHOT_DIR: dir });
    const nasa = createNasaFetch();

    const first = await new NasaSnapshotService({
      config,
      nasaFetch: nasa.fetch,
      now: () => DAY_15,
      recorded: null,
    }).get();

    const files = await readdir(dir);
    expect(files).toContain('snapshot-2026-11-15.json');

    const restartCounters = createNasaFetch();
    const second = await new NasaSnapshotService({
      config,
      nasaFetch: restartCounters.fetch,
      now: () => DAY_15 + 3 * HOUR,
      recorded: null,
    }).get();

    expect(second.cache).toBe('hit');
    expect(second.data).toEqual(first.data);
    expect(restartCounters.counters.cme).toBe(0);
  });

  it('serves the most recent saved snapshot as recorded when today fails', async () => {
    const dir = await tempSnapshotDir();
    const config = testConfig({ NASA_SNAPSHOT_DIR: dir });

    const yesterday = await new NasaSnapshotService({
      config,
      nasaFetch: createNasaFetch().fetch,
      now: () => DAY_15 - 24 * HOUR,
      recorded: null,
    }).get();
    expect(yesterday.data.snapshotId).toBe('2026-11-14');

    const failing = createNasaFetch();
    failing.setFailing(true);
    const today = await new NasaSnapshotService({
      config,
      nasaFetch: failing.fetch,
      now: () => DAY_15,
      recorded: null,
    }).get();

    expect(today.cache).toBe('recorded');
    expect(today.data.source).toBe('recorded');
    expect(today.data.snapshotId).toBe('2026-11-14');
    expect(today.data.bonus).toBe(10);
    expect(today.data.spaceWeather?.activityLevel).toBe('Storm Watch');
  });
});
