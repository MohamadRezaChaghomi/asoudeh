import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getJalaliMonthDays,
  getJalaliParts,
  getTehranTodayIso,
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

test('uses a valid Tehran Gregorian date for the latest selectable day', () => {
  assert.match(getTehranTodayIso(), /^\d{4}-\d{2}-\d{2}$/);
});
