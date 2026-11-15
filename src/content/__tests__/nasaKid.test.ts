import { describe, expect, it } from 'vitest';
import { checkKidText } from '../../../scripts/check-kid-text';
import { flareKidText, formatKidDate, weatherKidBrief } from '../../shared/nasa/kidText';

describe('kid-facing NASA text', () => {
  it('passes the short-sentence, no-banned-word guard', () => {
    expect(checkKidText()).toEqual([]);
  });

  it('formats flare text from validated values only', () => {
    const text = flareKidText({
      classType: 'M1.2',
      classLabel: 'M',
      tier: 'medium',
      peakTime: '2026-11-12T08:00:00Z',
      beginTime: '2026-11-12T07:50:00Z',
    });
    expect(text.short).toBe('On 12 November, NASA saw a medium flare on the Sun.');
    expect(text.detail).toContain('A flare class M is medium strong.');
  });

  it('falls back to a neutral flare sentence when the date is unusable', () => {
    const text = flareKidText({
      classType: 'M1.2',
      classLabel: 'M',
      tier: 'medium',
      peakTime: null,
      beginTime: 'not-a-date',
    });
    expect(text.short).not.toContain('undefined');
    expect(text.short).not.toContain('NaN');
    expect(text.short.length).toBeGreaterThan(0);
  });

  it('never formats an invalid date as a sentence', () => {
    expect(formatKidDate('')).toBe('');
    expect(formatKidDate('2026-13-40')).toBe('');
    expect(formatKidDate('2026-11-12T00:00:00Z')).toBe('12 November');
  });

  it('summarises space weather without raw NASA text', () => {
    const line = weatherKidBrief({
      activityLevel: 'Storm Watch',
      cmeCount: 3,
      maxCmeSpeedKmS: 1100,
      maxKpIndex: 7,
      sepCount: 1,
    });
    expect(line).toContain('NASA saw 3 solar eruptions in 28 days.');
    expect(line).toContain('stormy');
  });
});
