import { describe, expect, it } from 'vitest';
import {
  cleanText,
  computeBonus,
  countFlareClasses,
  neutralFlareWindow,
  neutralOsdr,
  neutralRadlab,
  neutralSpaceWeather,
  parseDonkiCme,
  parseDonkiFlr,
  parseDonkiGst,
  parseDonkiSep,
  parseOsdr,
  parseRadlab,
  pickFeaturedFlare,
  stripHtml,
  summarizeSpaceWeather,
} from '../nasa/parsers';
import {
  DONKI_CME,
  DONKI_FLR,
  DONKI_GST,
  DONKI_SEP,
  OSDR_RAW,
  RADLAB_RAW,
} from './helpers';

const RADLAB_WINDOW = { start: '2022-04-01T23:00', end: '2022-04-02T01:05' };

describe('DONKI parsers', () => {
  it('parses a well-shaped CME list and rounds the most accurate speed', () => {
    const parsed = parseDonkiCme(DONKI_CME);
    expect(parsed.count).toBe(2);
    expect(parsed.maxSpeedKmS).toBe(1200);
    expect(parsed.items[0].speedKmS).toBe(1200);
    expect(parsed.items[1].speedKmS).toBe(651);
  });

  it('survives empty arrays, null and completely wrong types', () => {
    for (const raw of [[], null, undefined, 'nope', 42, { hits: [] }]) {
      const parsed = parseDonkiCme(raw);
      expect(parsed.count).toBe(0);
      expect(parsed.maxSpeedKmS).toBe(0);
    }
  });

  it('drops CMEs without a usable start time and keeps the rest', () => {
    const parsed = parseDonkiCme([
      { activityID: 'A', note: 'no start time' },
      { activityID: 'B', startTime: 'not-a-date', cmeAnalyses: [] },
      { activityID: 'C', startTime: '2024-05-10T00:00:00Z', cmeAnalyses: [] },
    ]);
    expect(parsed.items.map(item => item.id)).toEqual(['C']);
    expect(parsed.items[0].speedKmS).toBeNull();
  });

  it('strips HTML and caps very long free text', () => {
    const parsed = parseDonkiCme([
      {
        activityID: 'A',
        startTime: '2024-05-10T00:00:00Z',
        note: `<b>Fast</b> &amp; bright ${'x'.repeat(5000)}`,
        cmeAnalyses: [{ isMostAccurate: true, speed: -12 }, { isMostAccurate: true, speed: 'fast' }],
      },
    ]);
    expect(parsed.items[0].note.startsWith('Fast & bright')).toBe(true);
    expect(parsed.items[0].note.length).toBeLessThanOrEqual(181);
    expect(parsed.items[0].speedKmS).toBeNull();
  });

  it('rejects unsafe upstream links and keeps a stable DONKI page', () => {
    const parsed = parseDonkiCme([
      { activityID: 'A', startTime: '2024-05-10T00:00:00Z', link: 'javascript:alert(1)' },
      { activityID: 'B', startTime: '2024-05-11T00:00:00Z', link: 'http://insecure.test/cme' },
      {
        activityID: 'C',
        startTime: '2024-05-12T00:00:00Z',
        link: 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/view/CME/1',
      },
    ]);
    expect(parsed.items[0].link).toBe('https://ccmc.gsfc.nasa.gov/tools/DONKI/');
    expect(parsed.items[1].link).toBe('https://ccmc.gsfc.nasa.gov/tools/DONKI/');
    expect(parsed.items[2].link).toBe('https://ccmc.gsfc.nasa.gov/tools/DONKI/');
  });

  it('parses GST Kp indexes, ignoring malformed entries', () => {
    const parsed = parseDonkiGst([
      {
        gstID: 'GST-1',
        startTime: '2024-05-10T06:00:00Z',
        allKpIndex: [{ kpIndex: 5 }, { kpIndex: 12 }, 'x', { kpIndex: null }],
      },
      { gstID: 'GST-2', allKpIndex: 'not-an-array' },
    ]);
    expect(parsed.count).toBe(1);
    expect(parsed.maxKpIndex).toBe(9);
    expect(parsed.items[0].kpIndex).toBe(9);
  });

  it('counts only SEP records that identify themselves', () => {
    expect(parseDonkiSep([{ sepID: 'SEP-1' }]).count).toBe(1);
    expect(parseDonkiSep([{ sepID: 'SEP-2', eventTime: '2024-05-10T00:00:00Z' }]).count).toBe(1);
    expect(parseDonkiSep([{}, null, 'x']).count).toBe(0);
    expect(parseDonkiSep(DONKI_SEP).count).toBe(1);
  });
});

describe('DONKI FLR parser', () => {
  it('parses flares with class letter, tier and kid text', () => {
    const flares = parseDonkiFlr(DONKI_FLR);
    expect(flares).toHaveLength(3);
    const x = flares.find(flare => flare.classLabel === 'X');
    expect(x?.tier).toBe('strong');
    expect(x?.kid.short).toContain('NASA saw a strong flare');
    const m = flares.find(flare => flare.classLabel === 'M');
    expect(m?.tier).toBe('medium');
    expect(m?.kid.detail).toContain('flare class M is medium strong');
  });

  it('drops flares without a class or a start time, and strips HTML', () => {
    const flares = parseDonkiFlr([
      { flrID: 'A', beginTime: '2024-05-10T00:00:00Z' },
      { flrID: 'B', classType: '<b>M1.0</b>' },
      { flrID: 'C', beginTime: '2024-05-10T00:00:00Z', classType: '<b>M2.0</b>' },
      { flrID: 'D', beginTime: '2024-05-10T00:00:00Z', classType: 'Z9' },
    ]);
    expect(flares.map(flare => flare.id)).toEqual(['C']);
    expect(flares[0].classType).toBe('M2.0');
  });

  it('returns an empty list for empty or wrong-shaped data', () => {
    expect(parseDonkiFlr([])).toEqual([]);
    expect(parseDonkiFlr(null)).toEqual([]);
    expect(parseDonkiFlr({ flares: 3 })).toEqual([]);
  });

  it('ranks X over M over C and breaks ties by recency', () => {
    const flares = parseDonkiFlr(DONKI_FLR);
    expect(pickFeaturedFlare(flares)?.classLabel).toBe('X');
    expect(pickFeaturedFlare([])).toBeNull();

    const tie = parseDonkiFlr([
      { flrID: 'old', beginTime: '2024-05-10T00:00:00Z', classType: 'M1.0' },
      { flrID: 'new', beginTime: '2024-05-11T00:00:00Z', classType: 'M2.0' },
    ]);
    expect(pickFeaturedFlare(tie)?.id).toBe('new');
    expect(countFlareClasses(tie)).toEqual({ c: 0, m: 2, x: 0 });
  });
});

describe('computeBonus', () => {
  const base = { sepCount: 0, maxKpIndex: 0, maxCmeSpeedKmS: 0, cmeCount: 0 };

  it('gives 10 at the Storm Watch thresholds', () => {
    expect(computeBonus({ ...base, sepCount: 1 })).toBe(10);
    expect(computeBonus({ ...base, maxKpIndex: 6 })).toBe(10);
    expect(computeBonus({ ...base, maxCmeSpeedKmS: 1000 })).toBe(10);
  });

  it('gives 5 at the Elevated thresholds', () => {
    expect(computeBonus({ ...base, maxKpIndex: 5 })).toBe(5);
    expect(computeBonus({ ...base, maxCmeSpeedKmS: 650 })).toBe(5);
    expect(computeBonus({ ...base, cmeCount: 12 })).toBe(5);
  });

  it('gives 0 below every threshold', () => {
    expect(computeBonus(base)).toBe(0);
    expect(computeBonus({ ...base, cmeCount: 11, maxCmeSpeedKmS: 649, maxKpIndex: 4 })).toBe(0);
  });
});

describe('space weather summary', () => {
  it('marks the payload live and uses the unchanged thresholds', () => {
    const summary = summarizeSpaceWeather(
      DONKI_CME,
      DONKI_GST,
      DONKI_SEP,
      '2026-10-18',
      '2026-11-15',
      '2026-11-15T00:00:00.000Z'
    );
    expect(summary.source).toBe('live');
    expect(summary.activityLevel).toBe('Storm Watch');
    expect(summary.recommendedFlareBonus).toBe(10);
    expect(summary.recordedOn).toBeUndefined();
  });

  it('is Quiet with bonus 0 when every feed is empty', () => {
    const summary = summarizeSpaceWeather([], [], [], '2026-10-18', '2026-11-15', '2026-11-15T00:00:00.000Z');
    expect(summary.activityLevel).toBe('Quiet');
    expect(summary.recommendedFlareBonus).toBe(0);
    expect(summary.latestCme).toBeNull();
    expect(summary.latestGst).toBeNull();
  });
});

describe('RadLab parser', () => {
  it('summarises real-shaped rows and keeps the observed window', () => {
    const parsed = parseRadlab(RADLAB_RAW, {
      observedWindow: RADLAB_WINDOW,
      fetchedAt: '2026-11-15T00:00:00.000Z',
    });
    expect(parsed).not.toBeNull();
    expect(parsed?.source).toBe('live');
    expect(parsed?.sampleCount).toBe(3);
    expect(parsed?.avgDoseMicroGyHr).toBe(6.83);
    expect(parsed?.minDoseMicroGyHr).toBe(4.12);
    expect(parsed?.peakDoseMicroGyHr).toBe(9.88);
    expect(parsed?.observedWindow).toEqual(RADLAB_WINDOW);
    expect(parsed?.kidTakeaway).toContain('Space Station sensors');
  });

  it('returns null instead of guessing when the payload is unusable', () => {
    expect(parseRadlab(null, { observedWindow: RADLAB_WINDOW, fetchedAt: 'x' })).toBeNull();
    expect(parseRadlab({ columns: ['timestamp'], data: [] }, {
      observedWindow: RADLAB_WINDOW,
      fetchedAt: 'x',
    })).toBeNull();
    expect(
      parseRadlab(
        { columns: ['timestamp', 'absorbed_dose_rate'], data: [['2022-04-01T23:00:00', 'nope']] },
        { observedWindow: RADLAB_WINDOW, fetchedAt: 'x' }
      )
    ).toBeNull();
  });

  it('drops unreadable rows and clamps the sample list', () => {
    const data = Array.from({ length: 40 }, (_, index) => [
      index === 3 ? '' : `2022-04-01T23:${String(index).padStart(2, '0')}:00`,
      index % 2 === 0 ? 'DosTel1' : 'DosTel2',
      index === 5 ? Number.NaN : 4 + index,
      null,
    ]);
    const parsed = parseRadlab(
      { columns: ['timestamp', 'instrument_id', 'absorbed_dose_rate', 'flux'], data },
      { observedWindow: RADLAB_WINDOW, fetchedAt: 'x' }
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.sampleCount).toBe(38);
    expect(parsed?.samples.length).toBeLessThanOrEqual(6);
    expect(parsed?.instruments).toEqual(['DosTel1', 'DosTel2']);
  });
});

describe('OSDR parser', () => {
  it('parses studies, strips HTML and repairs a partial study URL', () => {
    const parsed = parseOsdr(
      {
        hits: {
          total: 3,
          hits: [
            {
              _id: 'hit-1',
              _source: {
                Accession: 'OSD-319',
                'Study Title': '<b>Muscle atrophy</b> in hibernating mammals',
                organism: 'Urocitellus parryii',
                'Flight Program': '',
                'Space Program': '',
                'Study Description': '  <p>Long   description</p> ',
                'Authoritative Source URL': 'OSD-319/',
              },
            },
            { _id: 'hit-2', _source: { Accession: 'OSD-100' } },
            { _id: 'hit-3', _source: { Accession: 'bad accession!', 'Study Title': 'x' } },
          ],
        },
      },
      'bone',
      { fetchedAt: '2026-11-15T00:00:00.000Z' }
    );
    expect(parsed.studies).toHaveLength(1);
    expect(parsed.studies[0]).toMatchObject({
      accession: 'OSD-319',
      title: 'Muscle atrophy in hibernating mammals',
      flightProgram: 'NASA',
      url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-319',
    });
    expect(parsed.studies[0].summary).toBe('Long description');
    expect(parsed.totalHits).toBe(3);
  });

  it('returns an empty, honest list for wrong-shaped data', () => {
    const parsed = parseOsdr({ hits: { hits: 'nope' } }, 'food', {
      fetchedAt: '2026-11-15T00:00:00.000Z',
    });
    expect(parsed.studies).toEqual([]);
    expect(parsed.totalHits).toBe(0);
    expect(parsed.source).toBe('live');
  });

  it('caps very long titles and descriptions', () => {
    const parsed = parseOsdr(
      {
        hits: {
          total: 1,
          hits: [
            {
              _id: 'x',
              _source: {
                Accession: 'OSD-1',
                'Study Title': 'T'.repeat(900),
                'Study Description': 'D'.repeat(900),
              },
            },
          ],
        },
      },
      'radiation',
      { fetchedAt: '2026-11-15T00:00:00.000Z' }
    );
    expect(parsed.studies[0].title.length).toBeLessThanOrEqual(301);
    expect(parsed.studies[0].summary.length).toBeLessThanOrEqual(191);
  });

  it('parses the captured real response shape', () => {
    const parsed = parseOsdr(OSDR_RAW, 'bone', { fetchedAt: '2026-11-15T00:00:00.000Z' });
    expect(parsed.totalHits).toBe(2);
    expect(parsed.studies[0].url).toBe(
      'https://osdr.nasa.gov/bio/repo/data/studies/OSD-100'
    );
  });
});

describe('text helpers', () => {
  it('strips markup, decodes entities and bounds lengths', () => {
    expect(stripHtml('<p>a &amp; b</p>\n c')).toBe('a & b c');
    expect(cleanText('   ', 10)).toBeNull();
    expect(cleanText(12, 10)).toBe('12');
    expect(cleanText('abcdefghijkl', 5)).toBe('abcd…');
  });
});

describe('honest neutral fallbacks', () => {
  it('contains no invented NASA numbers', () => {
    const weather = neutralSpaceWeather('2026-10-18', '2026-11-15', '2026-11-15T00:00:00.000Z');
    expect(weather.source).toBe('fallback');
    expect(weather.recommendedFlareBonus).toBe(0);
    expect(weather.cmeCount).toBe(0);
    expect(weather.maxCmeSpeedKmS).toBe(0);
    expect(weather.gstCount).toBe(0);
    expect(weather.maxKpIndex).toBe(0);
    expect(weather.sepCount).toBe(0);
    expect(weather.latestCme).toBeNull();
    expect(weather.latestGst).toBeNull();

    const radlab = neutralRadlab(RADLAB_WINDOW, '2026-11-15T00:00:00.000Z');
    expect(radlab.source).toBe('fallback');
    expect(radlab.sampleCount).toBe(0);
    expect(radlab.avgDoseMicroGyHr).toBe(0);
    expect(radlab.peakDoseMicroGyHr).toBe(0);
    expect(radlab.samples).toEqual([]);

    const osdr = neutralOsdr('bone', '2026-11-15T00:00:00.000Z');
    expect(osdr.source).toBe('fallback');
    expect(osdr.totalHits).toBe(0);
    expect(osdr.studies).toEqual([]);

    const flares = neutralFlareWindow('2026-10-18', '2026-11-15', '2026-11-15T00:00:00.000Z');
    expect(flares.featured).toBeNull();
    expect(flares.flares).toEqual([]);
    expect(flares.counts).toEqual({ c: 0, m: 0, x: 0 });
  });
});
