import { describe, expect, it } from 'vitest';
import {
  formatUtcDateOnly,
  getJalaliMonthRange,
} from '../utils/jalaliMonth.js';

describe('Jalali month ranges', () => {
  it('returns Gregorian UTC boundaries matching the requested Solar Hijri month', () => {
    const range = getJalaliMonthRange(1405, 7);
    const lastIncludedDay = new Date(range.endDateExclusive.getTime() - 86_400_000);

    expect(formatUtcDateOnly(range.startDate)).toBe('2026-09-23');
    expect(formatUtcDateOnly(range.endDateExclusive)).toBe('2026-10-23');
    expect(
      new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(range.startDate),
    ).toContain('7/1/1405');
    expect(
      new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(lastIncludedDay),
    ).toContain('7/30/1405');
  });

  it.each([
    [1200, 0],
    [1200, 13],
    [1199, 1],
    [1601, 1],
  ])('rejects an invalid Jalali month (%i, %i)', (year, month) => {
    expect(() => getJalaliMonthRange(year, month)).toThrow(RangeError);
  });
});
