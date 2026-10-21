import { describe, expect, it } from 'vitest';
import {
  formatJalaliMonthKey,
  formatUtcDateOnly,
  getCurrentJalaliMonthRange,
  getJalaliDateParts,
  getJalaliMonthRange,
  getMonthlyOccurrenceDate,
} from '../utils/jalaliMonth.js';

describe('Jalali reminder calendar rules', () => {
  it('uses the established MM-YYYY month key and validates month/year ranges', () => {
    expect(formatJalaliMonthKey(1405, 7)).toBe('07-1405');
    expect(() => formatJalaliMonthKey(1405, 13)).toThrow(RangeError);
    expect(() => formatJalaliMonthKey(1601, 1)).toThrow(RangeError);
  });

  it('preserves a 31st Jalali day while clamping short months without changing the anchor', () => {
    const anchorRange = getJalaliMonthRange(1405, 6);
    const anchor = new Date(anchorRange.startDate.getTime() + 30 * 86_400_000);
    expect(getJalaliDateParts(anchor).day).toBe(31);

    const shortOccurrence = getMonthlyOccurrenceDate(anchor, 1405, 7);
    expect(shortOccurrence).toBeDefined();
    expect(getJalaliDateParts(shortOccurrence!).day).toBe(30);

    const followingOccurrence = getMonthlyOccurrenceDate(anchor, 1406, 1);
    expect(followingOccurrence).toBeDefined();
    expect(getJalaliDateParts(followingOccurrence!).day).toBe(31);
  });

  it('preserves a 30th Jalali day and clamps it only in shorter Esfand', () => {
    const anchorRange = getJalaliMonthRange(1404, 6);
    const anchor = new Date(anchorRange.startDate.getTime() + 29 * 86_400_000);
    expect(getJalaliDateParts(anchor).day).toBe(30);
    expect(getJalaliDateParts(getMonthlyOccurrenceDate(anchor, 1404, 12)!).day).toBe(29);
    expect(getJalaliDateParts(getMonthlyOccurrenceDate(anchor, 1405, 1)!).day).toBe(30);
  });

  it('clamps Esfand to its actual leap or common-year end and resumes the original day', () => {
    const esfandLeap = getJalaliMonthRange(1403, 12);
    const esfandCommon = getJalaliMonthRange(1404, 12);
    expect((esfandLeap.endDateExclusive.getTime() - esfandLeap.startDate.getTime()) / 86_400_000)
      .toBe(30);
    expect((esfandCommon.endDateExclusive.getTime() - esfandCommon.startDate.getTime()) / 86_400_000)
      .toBe(29);

    const anchor = new Date(getJalaliMonthRange(1403, 6).startDate.getTime() + 30 * 86_400_000);
    expect(getJalaliDateParts(anchor).day).toBe(31);
    const leapOccurrence = getMonthlyOccurrenceDate(anchor, 1403, 12);
    const commonOccurrence = getMonthlyOccurrenceDate(anchor, 1404, 12);
    expect(getJalaliDateParts(leapOccurrence!).day).toBe(30);
    expect(getJalaliDateParts(commonOccurrence!).day).toBe(29);
    expect(getJalaliDateParts(getMonthlyOccurrenceDate(anchor, 1405, 1)!).day).toBe(31);
  });

  it('derives current Jalali month from Tehran local date around midnight boundaries', () => {
    const beforeTehranMidnight = new Date('2026-10-22T20:29:59.000Z');
    const atTehranMidnight = new Date('2026-10-22T20:30:00.000Z');
    const before = getCurrentJalaliMonthRange(beforeTehranMidnight);
    const after = getCurrentJalaliMonthRange(atTehranMidnight);

    expect(formatUtcDateOnly(before.today)).toBe('2026-10-22');
    expect(formatUtcDateOnly(after.today)).toBe('2026-10-23');
    expect(formatJalaliMonthKey(before.year, before.month)).toBe('07-1405');
    expect(formatJalaliMonthKey(after.year, after.month)).toBe('08-1405');
  });

  it('uses the original anchor date rather than recursively clamping a previous occurrence', () => {
    const anchor = new Date(getJalaliMonthRange(1405, 6).startDate.getTime() + 30 * 86_400_000);
    const clamped = getMonthlyOccurrenceDate(anchor, 1405, 7)!;
    expect(getJalaliDateParts(clamped).day).toBe(30);
    expect(getJalaliDateParts(getMonthlyOccurrenceDate(anchor, 1406, 1)!).day).toBe(31);
  });
});
