import { describe, expect, it } from 'vitest';
import {
  formatJalaliMonthKey,
  formatUtcDateOnly,
  getCurrentJalaliMonthRange,
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

  it.each([
    [1402, '2024-02-20', '2024-03-20', 29],
    [1403, '2025-02-19', '2025-03-21', 30],
  ])('handles Esfand boundaries for %i', (year, startDate, endDate, lastDay) => {
    const range = getJalaliMonthRange(year, 12);
    expect(formatUtcDateOnly(range.startDate)).toBe(startDate);
    expect(formatUtcDateOnly(range.endDateExclusive)).toBe(endDate);
    expect(
      new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(range.endDateExclusive.getTime() - 86_400_000)),
    ).toContain(`12/${lastDay}/${year}`);
  });

  it('switches Solar Hijri months at Tehran midnight without shifting date-only boundaries', () => {
    const beforeNowruz = getCurrentJalaliMonthRange(new Date('2024-03-19T20:29:59.999Z'));
    const atNowruz = getCurrentJalaliMonthRange(new Date('2024-03-19T20:30:00.000Z'));

    expect(formatJalaliMonthKey(beforeNowruz.year, beforeNowruz.month)).toBe('12-1402');
    expect(formatJalaliMonthKey(atNowruz.year, atNowruz.month)).toBe('01-1403');
    expect(formatUtcDateOnly(atNowruz.startDate)).toBe('2024-03-20');
  });
});
