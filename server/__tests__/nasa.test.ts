import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  createNasaFetch,
  createTestApp,
  expectExactKeys,
  syntheticRecordedFixture,
  testConfig,
} from './helpers';

const SPACE_WEATHER_KEYS = [
  'source',
  'windowStart',
  'windowEnd',
  'fetchedAt',
  'activityLevel',
  'recommendedFlareBonus',
  'cmeCount',
  'maxCmeSpeedKmS',
  'gstCount',
  'maxKpIndex',
  'sepCount',
  'latestCme',
  'latestGst',
  'kidBrief',
];

const RADLAB_KEYS = [
  'source',
  'spacecraft',
  'instruments',
  'sampleCount',
  'avgDoseMicroGyHr',
  'minDoseMicroGyHr',
  'peakDoseMicroGyHr',
  'samples',
  'kidTakeaway',
  'portalUrl',
  'observedWindow',
  'fetchedAt',
];

const OSDR_KEYS = ['source', 'topic', 'totalHits', 'studies', 'fetchedAt'];

const FLARE_KEYS = [
  'source',
  'windowStart',
  'windowEnd',
  'fetchedAt',
  'featured',
  'counts',
  'flares',
];

const SNAPSHOT_KEYS = [
  'snapshotId',
  'generatedAt',
  'source',
  'bonus',
  'spaceWeather',
  'flare',
  'radiation',
  'provenance',
];

describe('NASA proxies', () => {
  it('space-weather keeps every old field and adds no invented value', async () => {
    const nasa = createNasaFetch();
    const { app } = createTestApp({ nasaFetch: nasa.fetch });

    const response = await request(app).get('/api/nasa/space-weather');

    expect(response.status).toBe(200);
    expectExactKeys(response.body, SPACE_WEATHER_KEYS);
    expectExactKeys(response.body.latestCme, ['id', 'startTime', 'speedKmS', 'note', 'link']);
    expectExactKeys(response.body.latestGst, ['id', 'startTime', 'kpIndex', 'link']);

    expect(response.body.source).toBe('live');
    expect(response.body.activityLevel).toBe('Storm Watch');
    expect(response.body.recommendedFlareBonus).toBe(10);
    expect(response.body.cmeCount).toBe(2);
    expect(response.body.maxCmeSpeedKmS).toBe(1200);
    expect(response.body.gstCount).toBe(1);
    expect(response.body.maxKpIndex).toBe(7);
    expect(response.body.sepCount).toBe(1);
    expect(response.body.latestCme.id).toBe('2024-05-11T00:00:00-CME-002');
    expect(response.body.latestCme.note).toBe('Slower CME.');

    expect(response.headers['x-cache']).toBe('miss');
    expect(response.headers['cache-control']).toBe('public, max-age=60');

    const cached = await request(app).get('/api/nasa/space-weather');
    expect(cached.status).toBe(200);
    expect(cached.headers['x-cache']).toBe('hit');
    expect(cached.body).toEqual(response.body);
  });

  it('radlab is labelled as a recording with its real window', async () => {
    const nasa = createNasaFetch();
    const { app } = createTestApp({ nasaFetch: nasa.fetch });

    const response = await request(app).get('/api/nasa/radlab');

    expect(response.status).toBe(200);
    expectExactKeys(response.body, RADLAB_KEYS);
    for (const sample of response.body.samples) {
      expectExactKeys(sample, ['timestamp', 'instrumentId', 'absorbedDoseRate', 'flux']);
    }

    expect(response.body.source).toBe('live');
    expect(response.body.spacecraft).toBe('International Space Station (ISS)');
    expect(response.body.instruments).toEqual(['DosTel1', 'DosTel2']);
    expect(response.body.sampleCount).toBe(3);
    expect(response.body.avgDoseMicroGyHr).toBe(6.83);
    expect(response.body.peakDoseMicroGyHr).toBe(9.88);
    expect(response.body.observedWindow).toEqual({
      start: '2022-04-01T23:00',
      end: '2022-04-02T01:05',
    });
    expect(nasa.urls.some(url => url.includes('timestamp%3E=2022-04-01T23%3A00'))).toBe(true);
    expect(response.headers['x-cache']).toBe('miss');
  });

  it('honours RADLAB_WINDOW_START / RADLAB_WINDOW_END', async () => {
    const nasa = createNasaFetch();
    const { app } = createTestApp({
      nasaFetch: nasa.fetch,
      config: testConfig({
        RADLAB_WINDOW_START: '2022-05-01T00:00',
        RADLAB_WINDOW_END: '2022-05-01T02:00',
      }),
    });

    const response = await request(app).get('/api/nasa/radlab');
    expect(response.body.observedWindow).toEqual({
      start: '2022-05-01T00:00',
      end: '2022-05-01T02:00',
    });
    expect(
      nasa.urls.some(url => url.includes('timestamp%3E=2022-05-01T00%3A00'))
    ).toBe(true);
  });

  it('osdr uses the verified search parameters and additive field', async () => {
    const nasa = createNasaFetch();
    const { app } = createTestApp({ nasaFetch: nasa.fetch });

    const response = await request(app).get('/api/nasa/osdr?topic=bone');

    expect(response.status).toBe(200);
    expectExactKeys(response.body, OSDR_KEYS);
    for (const study of response.body.studies) {
      expectExactKeys(study, ['accession', 'title', 'organism', 'flightProgram', 'summary', 'url']);
    }

    expect(response.body.source).toBe('live');
    expect(response.body.topic).toBe('bone');
    expect(response.body.totalHits).toBe(2);
    expect(response.body.studies).toHaveLength(2);
    expect(response.body.studies[0]).toMatchObject({
      accession: 'OSD-100',
      organism: 'Mus musculus',
      flightProgram: 'International Space Station (ISS)',
      url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-100',
    });
    expect(
      nasa.urls.some(
        url =>
          url.includes('osdr.nasa.gov/osdr/data/search') &&
          url.includes('type=cgene') &&
          url.includes('bone%20muscle%20atrophy')
      )
    ).toBe(true);
  });

  it('flares expose the real DONKI records with kid text', async () => {
    const nasa = createNasaFetch();
    const { app } = createTestApp({ nasaFetch: nasa.fetch });

    const response = await request(app).get('/api/nasa/flares');

    expect(response.status).toBe(200);
    expectExactKeys(response.body, FLARE_KEYS);
    expect(response.body.source).toBe('live');
    expect(response.body.counts).toEqual({ c: 1, m: 1, x: 1 });
    expect(response.body.featured.classLabel).toBe('X');
    expect(response.body.featured.kid.short).toContain('NASA saw a strong flare');
    expectExactKeys(response.body.featured, [
      'id',
      'beginTime',
      'peakTime',
      'classType',
      'classLabel',
      'tier',
      'sourceLocation',
      'link',
      'kid',
    ]);
    expect(nasa.urls.some(url => url.includes('DONKI/FLR'))).toBe(true);
  });

  it('invalid topics fall back to bone, matching the old behaviour', async () => {
    const nasa = createNasaFetch();
    const { app } = createTestApp({ nasaFetch: nasa.fetch });

    const response = await request(app).get('/api/nasa/osdr?topic=not-a-topic');

    expect(response.status).toBe(200);
    expect(response.body.topic).toBe('bone');
    expect(nasa.urls.some(url => url.includes('bone%20muscle%20atrophy'))).toBe(true);
  });

  it('serves neutral fallbacks with zeroed numbers and source "fallback" when every call fails', async () => {
    const nasa = createNasaFetch();
    nasa.setFailing(true);
    const { app } = createTestApp({ nasaFetch: nasa.fetch, nasaRecorded: null });

    const weather = await request(app).get('/api/nasa/space-weather');
    expect(weather.status).toBe(200);
    expectExactKeys(weather.body, [...SPACE_WEATHER_KEYS, 'note']);
    expect(weather.body.source).toBe('fallback');
    expect(weather.body.recommendedFlareBonus).toBe(0);
    expect(weather.body.cmeCount).toBe(0);
    expect(weather.body.maxCmeSpeedKmS).toBe(0);
    expect(weather.body.maxKpIndex).toBe(0);
    expect(weather.body.latestCme).toBeNull();
    expect(weather.body.latestGst).toBeNull();
    expect(weather.headers['x-cache']).toBe('fallback');

    const radlab = await request(app).get('/api/nasa/radlab');
    expect(radlab.status).toBe(200);
    expectExactKeys(radlab.body, [...RADLAB_KEYS, 'note']);
    expect(radlab.body.source).toBe('fallback');
    expect(radlab.body.sampleCount).toBe(0);
    expect(radlab.body.peakDoseMicroGyHr).toBe(0);
    expect(radlab.body.samples).toEqual([]);
    expect(radlab.headers['x-cache']).toBe('fallback');

    const osdr = await request(app).get('/api/nasa/osdr?topic=food');
    expect(osdr.status).toBe(200);
    expectExactKeys(osdr.body, [...OSDR_KEYS, 'note']);
    expect(osdr.body.source).toBe('fallback');
    expect(osdr.body.topic).toBe('food');
    expect(osdr.body.totalHits).toBe(0);
    expect(osdr.body.studies).toEqual([]);
    expect(osdr.headers['x-cache']).toBe('fallback');

    const flares = await request(app).get('/api/nasa/flares');
    expect(flares.status).toBe(200);
    expect(flares.body.source).toBe('fallback');
    expect(flares.body.featured).toBeNull();
    expect(flares.body.flares).toEqual([]);
    expect(flares.headers['x-cache']).toBe('fallback');

    const snapshot = await request(app).get('/api/nasa/snapshot');
    expect(snapshot.status).toBe(200);
    expect(snapshot.body.source).toBe('unavailable');
    expect(snapshot.body.bonus).toBe(0);
    expect(snapshot.body.spaceWeather).toBeNull();
    expect(snapshot.headers['x-cache']).toBe('fallback');
  });

  it('falls back to the committed real recording and labels it truthfully', async () => {
    const nasa = createNasaFetch();
    nasa.setFailing(true);
    const { app } = createTestApp({
      nasaFetch: nasa.fetch,
      nasaRecorded: syntheticRecordedFixture(),
    });

    const weather = await request(app).get('/api/nasa/space-weather');
    expect(weather.body.source).toBe('recorded');
    expect(weather.body.recommendedFlareBonus).toBe(10);
    expect(weather.body.recordedOn).toBe('2024-05-12T00:05:00.000Z');
    expect(weather.headers['x-cache']).toBe('recorded');

    const radlab = await request(app).get('/api/nasa/radlab');
    expect(radlab.body.source).toBe('recorded');
    expect(radlab.body.peakDoseMicroGyHr).toBe(9.88);
    expect(radlab.body.observedWindow.start).toBe('2022-04-01T23:00');

    const osdr = await request(app).get('/api/nasa/osdr?topic=bone');
    expect(osdr.body.source).toBe('recorded');
    expect(osdr.body.studies[0].accession).toBe('OSD-100');

    const flares = await request(app).get('/api/nasa/flares');
    expect(flares.body.source).toBe('recorded');
    expect(flares.body.featured.classLabel).toBe('X');
  });

  it('coalesces ten concurrent misses into one upstream call per feed', async () => {
    const nasa = createNasaFetch();
    const { app } = createTestApp({ nasaFetch: nasa.fetch });

    const weatherRequests = await Promise.all(
      Array.from({ length: 10 }, () => request(app).get('/api/nasa/space-weather'))
    );
    expect(weatherRequests.every(response => response.status === 200)).toBe(true);
    expect(nasa.counters.cme).toBe(1);
    expect(nasa.counters.gst).toBe(1);
    expect(nasa.counters.sep).toBe(1);

    const radlabRequests = await Promise.all(
      Array.from({ length: 10 }, () => request(app).get('/api/nasa/radlab'))
    );
    expect(radlabRequests.every(response => response.status === 200)).toBe(true);
    expect(nasa.counters.radlab).toBe(1);

    const osdrRequests = await Promise.all(
      Array.from({ length: 10 }, () => request(app).get('/api/nasa/osdr?topic=bone'))
    );
    expect(osdrRequests.every(response => response.status === 200)).toBe(true);
    expect(nasa.counters.osdr).toBe(1);
  });

  it('serves the last good payload with X-Cache: stale when the refresh fails', async () => {
    const nasa = createNasaFetch();
    const clock = { value: 1_700_000_000_000 };
    const { app } = createTestApp({ nasaFetch: nasa.fetch, now: () => clock.value });

    const first = await request(app).get('/api/nasa/radlab');
    expect(first.status).toBe(200);
    expect(first.headers['x-cache']).toBe('miss');
    expect(first.body.source).toBe('live');

    nasa.setFailing(true);
    // RadLab is a fixed recording, cached for 24 hours.
    clock.value += 25 * 60 * 60 * 1000;

    const stale = await request(app).get('/api/nasa/radlab');
    expect(stale.status).toBe(200);
    expect(stale.headers['x-cache']).toBe('stale');
    expect(stale.body.source).toBe('live');
    expect(stale.body).toEqual(first.body);
  });

  it('exposes the daily snapshot with stable fields and a cache header', async () => {
    const nasa = createNasaFetch();
    const { app } = createTestApp({ nasaFetch: nasa.fetch, now: () => Date.UTC(2026, 10, 15, 9) });

    const response = await request(app).get('/api/nasa/snapshot');
    expect(response.status).toBe(200);
    expectExactKeys(response.body, SNAPSHOT_KEYS);
    expect(response.body.snapshotId).toBe('2026-11-15');
    expect(response.body.bonus).toBe(10);
    expect(response.body.source).toBe('live');
    expect(response.body.flare.classLabel).toBe('X');
    expect(response.body.provenance.length).toBe(3);
    expect(response.headers['x-cache']).toBe('miss');

    const again = await request(app).get('/api/nasa/snapshot');
    expect(again.body).toEqual(response.body);
    expect(again.headers['x-cache']).toBe('hit');
  });

  it('rate limits /api/nasa/* to the configured budget', async () => {
    const nasa = createNasaFetch();
    const { app } = createTestApp({
      nasaFetch: nasa.fetch,
      rateLimits: { enabled: true, nasa: 2 },
    });

    const first = await request(app).get('/api/nasa/snapshot');
    const second = await request(app).get('/api/nasa/snapshot');
    const third = await request(app).get('/api/nasa/snapshot');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe('rate_limited');
  });
});
