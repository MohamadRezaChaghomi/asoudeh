import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getJalaliMonthDays,
  getJalaliParts,
  getTehranTodayIso,
  formatJalaliMonth,
  formatJalaliYear,
  shiftJalaliMonthKey,
  jalaliToGregorianIso,
} from '../lib/jalaliDate.ts';

test('converts Jalali new year and leap-year end dates to Gregorian ISO dates', () => {
  assert.equal(jalaliToGregorianIso({ year: 1403, month: 1, day: 1 }), '2024-03-20');
  assert.equal(jalaliToGregorianIso({ year: 1403, month: 12, day: 30 }), '2025-03-20');
  assert.deepEqual(getJalaliParts('2024-03-20'), { year: 1403, month: 1, day: 1 });
});

test('returns a complete Persian month and rejects impossible dates', () => {
  assert.equal(getJalaliMonthDays(1403, 1).length, 31);
  assert.equal(getJalaliMonthDays(1403, 12).length, 30);
  assert.throws(
    () => jalaliToGregorianIso({ year: 1402, month: 12, day: 30 }),
    RangeError,
  );
});

test('preserves date-only Jalali boundaries without shifting Farvardin or Esfand dates', () => {
  for (const [isoDate, expected] of [
    ['2024-03-19', { year: 1402, month: 12, day: 29 }],
    ['2024-03-20', { year: 1403, month: 1, day: 1 }],
    ['2025-03-20', { year: 1403, month: 12, day: 30 }],
    ['2025-03-21', { year: 1404, month: 1, day: 1 }],
  ]) {
    assert.deepEqual(getJalaliParts(isoDate), expected);
    assert.equal(jalaliToGregorianIso(expected), isoDate);
  }
});

test('uses a valid Tehran Gregorian date for the latest selectable day', () => {
  assert.match(getTehranTodayIso(), /^\d{4}-\d{2}-\d{2}$/);
});

test('formats Jalali years without grouping and pads years below four digits', () => {
  assert.equal(formatJalaliYear(1405), '۱۴۰۵');
  assert.equal(formatJalaliYear(999), '۰۹۹۹');
  assert.throws(() => formatJalaliYear(-1), RangeError);
});

test('shifts Jalali month keys across year boundaries and clamps supported years', () => {
  assert.equal(shiftJalaliMonthKey('01-1405', -1), '12-1404');
  assert.equal(shiftJalaliMonthKey('12-1405', 1), '01-1406');
  assert.equal(shiftJalaliMonthKey('01-1200', -1), '01-1200');
  assert.equal(shiftJalaliMonthKey('12-1600', 1), '12-1600');
  assert.throws(() => shiftJalaliMonthKey('13-1405', 1), RangeError);
});

test('formats a Jalali month key using its Persian month and year', () => {
  assert.equal(formatJalaliMonth('01-1405'), '۱۴۰۵ فروردین');
  assert.throws(() => formatJalaliMonth('00-1405'), RangeError);
});
