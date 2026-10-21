import { afterEach, describe, expect, it } from 'vitest';
import { env } from '../config/env.js';
import {
  generateOtp,
  hashOtp,
  normalizeIranianMobile,
  secureStringEqual,
} from '../utils/authCrypto.js';
import {
  completeRegistrationSchema,
  requestOtpSchema,
  updateProfileSchema,
  verifyOtpSchema,
} from '../validators/auth.validator.js';

const originalHashSecret = env.authHashSecret;

afterEach(() => {
  env.authHashSecret = originalHashSecret;
});

describe('Iranian mobile normalization', () => {
  it.each([
    ['09123456789', '09123456789'],
    ['+989123456789', '09123456789'],
    ['00989123456789', '09123456789'],
    ['989123456789', '09123456789'],
    ['۹۱۲۳۴۵۶۷۸۹', '09123456789'],
    ['٠٩١٢٣٤٥٦٧٨٩', '09123456789'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeIranianMobile(input)).toBe(expected);
  });

  it.each(['0912345678', '08123456789', '091234567890', 'not a phone'])(
    'rejects invalid number %s',
    (input) => {
      expect(normalizeIranianMobile(input)).toBeNull();
      expect(requestOtpSchema.safeParse({ phone: input }).success).toBe(false);
    },
  );
});

describe('Authentication validation and hashing', () => {
  it('generates only six-digit OTP values including leading zeroes', () => {
    for (let index = 0; index < 100; index += 1) {
      expect(generateOtp()).toMatch(/^\d{6}$/);
    }
  });

  it('stores a deterministic keyed OTP digest and compares equal strings safely', () => {
    env.authHashSecret = 'test-only-auth-hash-secret-with-more-than-32-bytes';

    expect(hashOtp('09123456789', '012345')).toMatch(/^[a-f0-9]{64}$/);
    expect(hashOtp('09123456789', '012345')).toBe(hashOtp('09123456789', '012345'));
    expect(hashOtp('09123456789', '012345')).not.toBe(hashOtp('09123456789', '012346'));
    expect(secureStringEqual('abc', 'abc')).toBe(true);
    expect(secureStringEqual('abc', 'abd')).toBe(false);
    expect(secureStringEqual('abc', 'longer')).toBe(false);
  });

  it('fails closed when the dedicated hash secret is missing or too short', () => {
    env.authHashSecret = 'short';
    expect(() => hashOtp('09123456789', '012345')).toThrowError(
      'سرویس احراز هویت هنوز پیکربندی نشده است.',
    );
  });

  it('validates six digit OTPs and trimmed display names', () => {
    expect(verifyOtpSchema.safeParse({ phone: '09123456789', code: '123456' }).success).toBe(true);
    expect(verifyOtpSchema.safeParse({ phone: '09123456789', code: '12345' }).success).toBe(false);
    expect(completeRegistrationSchema.parse({ displayName: '  مریم  ' }).displayName).toBe(
      'مریم',
    );
    expect(completeRegistrationSchema.safeParse({ displayName: ' ' }).success).toBe(false);
  });

  it('accepts non-negative toman balances and supported accessibility preferences', () => {
    expect(
      updateProfileSchema.safeParse({
        initialBalance: 0,
        accessibilitySettings: { fontScale: 1.5, highContrast: true },
      }).success,
    ).toBe(true);
    expect(updateProfileSchema.safeParse({ initialBalance: -1 }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ accessibilitySettings: { fontScale: 1.1 } }).success).toBe(
      false,
    );
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
  });
});
