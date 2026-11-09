import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { env, parseEnvironment } from '../config/env.js';
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
import { validateBody } from '../validators/validateBody.js';
import { errorHandler } from '../middleware/errorHandler.js';

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
  it('fails fast on weak or conflicting production secrets and non-HTTPS origins', () => {
    const productionConfig = {
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/asoudeh',
      JWT_SECRET: 'j'.repeat(32),
      AUTH_HASH_SECRET: 'h'.repeat(32),
      CLIENT_URL: 'https://app.example.test',
      OTP_DEV_SIMULATOR_ENABLED: 'false',
    };

    expect(parseEnvironment(productionConfig).NODE_ENV).toBe('production');
    expect(() =>
      parseEnvironment({ ...productionConfig, JWT_SECRET: 'short' }),
    ).toThrow(/JWT_SECRET/);
    expect(() =>
      parseEnvironment({ ...productionConfig, AUTH_HASH_SECRET: 'j'.repeat(32) }),
    ).toThrow(/distinct/);
    expect(() =>
      parseEnvironment({ ...productionConfig, CLIENT_URL: 'http://app.example.test' }),
    ).toThrow(/HTTPS/);
    expect(() =>
      parseEnvironment({ ...productionConfig, OTP_DEV_SIMULATOR_ENABLED: 'true' }),
    ).toThrow(/disabled/);
    expect(() =>
      parseEnvironment({ ...productionConfig, NODE_ENV: 'staging' }),
    ).toThrow(/NODE_ENV/);
  });

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
    expect(requestOtpSchema.safeParse({ phone: '09123456789', extra: true }).success).toBe(
      false,
    );
    expect(
      updateProfileSchema.safeParse({
        accessibilitySettings: { fontScale: 1, highContrast: false, extra: true },
      }).success,
    ).toBe(false);
  });

  it('rejects dotted and dollar-prefixed keys recursively before body validation', async () => {
    const app = express();
    app.use(express.json());
    app.post('/otp', validateBody(requestOtpSchema), (_req, res) => res.sendStatus(204));
    app.post('/profile', validateBody(updateProfileSchema), (_req, res) => res.sendStatus(204));
    app.use(errorHandler);

    const operatorKey = await request(app)
      .post('/otp')
      .send({ phone: '09123456789', $gt: '' });
    const dottedNestedKey = await request(app)
      .post('/profile')
      .send({
        accessibilitySettings: {
          fontScale: 1,
          highContrast: false,
          'preferences.fontScale': 2,
        },
      });

    expect(operatorKey.status).toBe(400);
    expect(operatorKey.body.error.code).toBe('INVALID_BODY_KEY');
    expect(dottedNestedKey.status).toBe(400);
    expect(dottedNestedKey.body.error.code).toBe('INVALID_BODY_KEY');
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
