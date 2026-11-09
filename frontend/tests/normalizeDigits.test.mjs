import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeDigits } from '../lib/normalizeDigits.ts';

test('normalizes Persian and Arabic-Indic digits while preserving other characters', () => {
  assert.equal(normalizeDigits('۰۹۱۲٣۴۵۶۷۸۹'), '09123456789');
  assert.equal(normalizeDigits('OTP: ۱۲۳٤٥٦'), 'OTP: 123456');
});
