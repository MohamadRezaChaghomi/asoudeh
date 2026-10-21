import { randomInt } from 'node:crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../app.js';
import { env } from '../config/env.js';
import AuthSession from '../models/AuthSession.js';
import OtpChallenge from '../models/OtpChallenge.js';
import OtpRateLimit from '../models/OtpRateLimit.js';
import User from '../models/User.js';
import { hashAuthValue } from '../utils/authCrypto.js';
import { revokeRefreshSession } from '../services/auth.service.js';
import { connectDB } from '../config/db.js';

const testMongoUri = process.env.TEST_MONGODB_URI;
const originalNodeEnv = env.nodeEnv;
const originalSimulatorSetting = env.otpDevSimulatorEnabled;
const originalFallbackCode = env.otpDevFallbackCode;
const originalAuthHashSecret = env.authHashSecret;
const origin = env.clientUrl;
const testPhones: string[] = [];
const testIps = new Set<string>();
let ipCounter = 1;

function isIsolatedTestUri(uri: string | undefined): uri is string {
  if (!uri) return false;

  try {
    const parsed = new URL(uri);
    return (
      ['127.0.0.1', 'localhost'].includes(parsed.hostname) &&
      decodeURIComponent(parsed.pathname.slice(1)) === 'asoudeh_test' &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

function nextTestIp(): string {
  const value = `198.51.100.${ipCounter}`;
  ipCounter += 1;
  testIps.add(value);
  return value;
}

async function createUniquePhone(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const phone = `09${randomInt(0, 1_000_000_000).toString().padStart(9, '0')}`;
    if (!(await User.exists({ phone }))) {
      testPhones.push(phone);
      return phone;
    }
  }

  throw new Error('Unable to allocate a unique isolated test phone number.');
}

function otpRequest(phone: string, ip = nextTestIp()) {
  return request(app)
    .post('/api/v1/auth/otp/request')
    .set('Origin', origin)
    .set('X-Forwarded-For', ip)
    .send({ phone });
}

function cookieValue(response: request.Response, name: string): string | undefined {
  const header = response.headers['set-cookie'];
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const cookie = cookies?.find((value) => value.startsWith(`${name}=`));
  return cookie?.split(';', 1)[0].slice(name.length + 1);
}

function cookieHeader(response: request.Response, name: string): string {
  const value = cookieValue(response, name);
  if (!value) throw new Error(`Expected ${name} cookie was not set.`);
  return value;
}

function setCookie(response: request.Response, name: string): string {
  const header = response.headers['set-cookie'];
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const cookie = cookies?.find((value) => value.startsWith(`${name}=`));
  if (!cookie) throw new Error(`Expected ${name} cookie was not set.`);
  return cookie;
}

describe.skipIf(!testMongoUri)('Authentication API', () => {
  beforeAll(async () => {
    if (!isIsolatedTestUri(testMongoUri)) {
      throw new Error(
        'Authentication API tests require local TEST_MONGODB_URI for database asoudeh_test.',
      );
    }
    if (!env.authHashSecret) {
      throw new Error('Authentication API tests require AUTH_HASH_SECRET.');
    }

    app.set('trust proxy', true);
    await connectDB(testMongoUri);
    await Promise.all([
      AuthSession.init(),
      OtpChallenge.init(),
      OtpRateLimit.init(),
      User.init(),
    ]);
  }, 20_000);

  beforeEach(() => {
    env.nodeEnv = 'development';
    env.otpDevSimulatorEnabled = true;
  });

  afterAll(async () => {
    const phoneHashes = testPhones.map((phone) => hashAuthValue('phone', phone));
    const rateIds = [
      ...testPhones.map((phone) => hashAuthValue('otp-rate-limit', `phone\0${phone}`)),
      ...Array.from(testIps, (ip) => hashAuthValue('otp-rate-limit', `ip\0${ip}`)),
    ];
    const users = await User.find({ phone: { $in: testPhones } }).select('_id').lean();

    if (users.length) {
      await AuthSession.deleteMany({ userId: { $in: users.map((user) => user._id) } });
    }
    env.nodeEnv = originalNodeEnv;
    env.otpDevSimulatorEnabled = originalSimulatorSetting;
    env.otpDevFallbackCode = originalFallbackCode;
    env.authHashSecret = originalAuthHashSecret;
    if (mongoose.connection.readyState === 1) {
      await User.deleteMany({ phone: { $in: testPhones } });
      await OtpChallenge.deleteMany({ phoneHash: { $in: phoneHashes } });
      await OtpRateLimit.deleteMany({ _id: { $in: rateIds } });
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }, 20_000);

  it('requires an allowed Origin and validates Iranian phone input', async () => {
    const phone = await createUniquePhone();
    const missingOrigin = await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ phone });
    const invalidPhone = await otpRequest('08123456789');
    const invalidBodyFromBadOrigin = await request(app)
      .post('/api/v1/auth/otp/request')
      .set('Origin', 'https://evil.example')
      .send({});

    expect(missingOrigin.status).toBe(403);
    expect(invalidPhone.status).toBe(400);
    expect(invalidPhone.body.error.code).toBe('VALIDATION_ERROR');
    expect(invalidBodyFromBadOrigin.status).toBe(403);
  });

  it('issues a readable CSRF cookie only to the configured Origin', async () => {
    const response = await request(app)
      .get('/api/v1/auth/csrf')
      .set('Origin', origin);
    const rejected = await request(app)
      .get('/api/v1/auth/csrf')
      .set('Origin', 'https://evil.example');

    expect(response.status).toBe(200);
    expect(response.body.data.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(setCookie(response, 'asoudeh_csrf')).toContain('Path=/api/v1');
    expect(setCookie(response, 'asoudeh_csrf')).not.toContain('HttpOnly');
    expect(rejected.status).toBe(403);
  });

  it('returns the development OTP only when explicitly enabled in development', async () => {
    const phone = await createUniquePhone();
    const developmentResponse = await otpRequest(phone);
    expect(developmentResponse.status).toBe(200);
    const developmentOtp = developmentResponse.body.data.developmentOtp as string;
    expect(developmentOtp).toBe(env.otpDevFallbackCode);
    const challenge = await OtpChallenge.findOne({
      phoneHash: hashAuthValue('phone', phone),
    }).lean();
    expect(challenge?.otpHash).toMatch(/^[a-f0-9]{64}$/);
    expect(challenge?.otpHash).not.toBe(developmentOtp);
    expect(new Date(String(challenge?.codeExpiresAt)).getTime() - Date.now()).toBeGreaterThan(
      4 * 60 * 1000,
    );

    const verified = await request(app)
      .post('/api/v1/auth/otp/verify')
      .set('Origin', origin)
      .send({ phone, code: env.otpDevFallbackCode });
    expect(verified.status).toBe(200);
    expect(verified.body.data.registrationRequired).toBe(true);

    const fallbackOnlyPhone = await createUniquePhone();
    await otpRequest(fallbackOnlyPhone);
    env.otpDevSimulatorEnabled = false;
    const disabledResponse = await otpRequest(await createUniquePhone());
    env.otpDevSimulatorEnabled = true;

    env.nodeEnv = 'production';
    env.otpDevSimulatorEnabled = true;
    const productionResponse = await otpRequest(await createUniquePhone());
    const replayedInProduction = await request(app)
      .post('/api/v1/auth/otp/verify')
      .set('Origin', origin)
      .send({ phone: fallbackOnlyPhone, code: env.otpDevFallbackCode });

    expect(disabledResponse.status).toBe(503);
    expect(JSON.stringify(disabledResponse.body)).not.toContain(env.otpDevFallbackCode);
    expect(productionResponse.status).toBe(503);
    expect(JSON.stringify(productionResponse.body)).not.toMatch(/\d{6}/);
    expect(JSON.stringify(productionResponse.body)).not.toContain('developmentOtp');
    expect(replayedInProduction.status).toBe(400);
  });

  it('limits OTP requests to three per phone in a rolling 15-minute window', async () => {
    const phone = await createUniquePhone();

    expect((await otpRequest(phone)).status).toBe(200);
    expect((await otpRequest(phone)).status).toBe(200);
    expect((await otpRequest(phone)).status).toBe(200);
    const limited = await otpRequest(phone);

    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBeTruthy();
  });

  it('limits OTP requests to ten per IP in a rolling 15-minute window', async () => {
    const ip = nextTestIp();

    for (let index = 0; index < 10; index += 1) {
      expect((await otpRequest(await createUniquePhone(), ip)).status).toBe(200);
    }

    const limited = await otpRequest(await createUniquePhone(), ip);
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBeTruthy();

    for (let index = 0; index < 5; index += 1) {
      expect((await otpRequest(await createUniquePhone(), ip)).status).toBe(429);
    }
    const ipRateLimitId = hashAuthValue('otp-rate-limit', `ip\0${ip}`);
    const retained = await OtpRateLimit.findById(ipRateLimitId).lean();
    expect(retained?.requestTimes).toHaveLength(10);
  });

  it('prunes timestamps outside the rolling request window', async () => {
    const phone = await createUniquePhone();
    const now = Date.now();
    const phoneRateLimitId = hashAuthValue('otp-rate-limit', `phone\0${phone}`);
    await OtpRateLimit.create({
      _id: phoneRateLimitId,
      requestTimes: [
        new Date(now - 16 * 60 * 1000),
        new Date(now - 14 * 60 * 1000),
        new Date(now - 13 * 60 * 1000),
      ],
      lastRequestId: 'previous-request',
      expiresAt: new Date(now + 60_000),
    });

    expect((await otpRequest(phone)).status).toBe(200);
    const retained = await OtpRateLimit.findById(phoneRateLimitId).lean();
    expect(retained?.requestTimes).toHaveLength(3);
    expect(new Date(String(retained?.requestTimes[0])).getTime()).toBeGreaterThan(
      Date.now() - 15 * 60 * 1000,
    );
  });

  it('preserves failed attempts when a code is resent and blocks after five failures', async () => {
    const phone = await createUniquePhone();
    const firstCode = (await otpRequest(phone)).body.data.developmentOtp as string;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      expect(
        (
          await request(app)
            .post('/api/v1/auth/otp/verify')
            .set('Origin', origin)
            .send({ phone, code: '000000' === firstCode ? '000001' : '000000' })
        ).status,
      ).toBe(400);
    }

    const secondCode = (await otpRequest(phone)).body.data.developmentOtp as string;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await request(app)
        .post('/api/v1/auth/otp/verify')
        .set('Origin', origin)
        .send({ phone, code: '999999' === secondCode ? '999998' : '999999' });
      expect(response.status).toBe(400);
    }

    const fifthFailure = await request(app)
      .post('/api/v1/auth/otp/verify')
      .set('Origin', origin)
      .send({ phone, code: secondCode === '123456' ? '123457' : '123456' });
    expect(fifthFailure.status).toBe(429);

    const resendDuringBlock = await otpRequest(phone);
    expect(resendDuringBlock.status).toBe(429);
    expect(resendDuringBlock.headers['retry-after']).toBeTruthy();
  });

  it('rejects expired OTPs', async () => {
    const phone = await createUniquePhone();
    const code = (await otpRequest(phone)).body.data.developmentOtp as string;
    const phoneHash = hashAuthValue('phone', phone);
    await OtpChallenge.updateOne(
      { phoneHash },
      { $set: { codeExpiresAt: new Date(Date.now() - 1) } },
    );

    const response = await request(app)
      .post('/api/v1/auth/otp/verify')
      .set('Origin', origin)
      .send({ phone, code });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('OTP_INVALID');
  });

  it('registers a verified phone, stores the profile, and sets secure session cookies', async () => {
    const phone = await createUniquePhone();
    const agent = request.agent(app);
    const sent = await agent
      .post('/api/v1/auth/otp/request')
      .set('Origin', origin)
      .set('X-Forwarded-For', nextTestIp())
      .send({ phone });
    const verified = await agent
      .post('/api/v1/auth/otp/verify')
      .set('Origin', origin)
      .send({ phone, code: sent.body.data.developmentOtp });

    expect(verified.body.data.registrationRequired).toBe(true);
    expect(cookieValue(verified, 'asoudeh_access')).toBeUndefined();
    expect(setCookie(verified, 'asoudeh_registration')).toContain('HttpOnly');
    const csrf = cookieHeader(verified, 'asoudeh_csrf');

    env.nodeEnv = 'production';
    const registered = await agent
      .post('/api/v1/auth/register/complete')
      .set('Origin', origin)
      .set('X-CSRF-Token', csrf)
      .send({ displayName: '  مریم آسوده  ' });

    expect(registered.status).toBe(201);
    expect(registered.body.data.profile).toMatchObject({
      displayName: 'مریم آسوده',
      phone,
      birthYear: null,
      initialBalance: 0,
    });
    expect(setCookie(registered, 'asoudeh_access')).toContain('HttpOnly');
    expect(setCookie(registered, 'asoudeh_access')).toContain('Secure');
    expect(setCookie(registered, 'asoudeh_access')).toContain('Path=/api/v1');
    expect(setCookie(registered, 'asoudeh_access')).toContain('Max-Age=900');
    expect(setCookie(registered, 'asoudeh_refresh')).toContain('Path=/api/v1/auth');
    expect(setCookie(registered, 'asoudeh_refresh')).toContain('Max-Age=2592000');
    expect(setCookie(registered, 'asoudeh_csrf')).not.toContain('HttpOnly');
    expect(setCookie(registered, 'asoudeh_csrf')).toContain('SameSite=Lax');
    expect(cookieValue(registered, 'asoudeh_registration')).toBe('');

    const storedUser = await User.findOne({ phone }).lean();
    expect(storedUser?.name).toBe('مریم آسوده');
    expect(storedUser?.initialBalance).toBe(0);
    const accessClaims = jwt.decode(cookieHeader(registered, 'asoudeh_access')) as
      | { iat: number; exp: number }
      | null;
    if (!accessClaims || typeof accessClaims.exp !== 'number' || typeof accessClaims.iat !== 'number') {
      throw new Error('The access cookie did not contain valid JWT lifetime claims.');
    }
    expect(accessClaims.exp - accessClaims.iat).toBe(15 * 60);
    const refreshHash = hashAuthValue(
      'refresh-token',
      cookieHeader(registered, 'asoudeh_refresh'),
    );
    const refreshSession = await AuthSession.findOne({ tokenHash: refreshHash }).lean();
    const refreshLifetime =
      refreshSession &&
      new Date(refreshSession.expiresAt).getTime() - new Date(refreshSession.createdAt).getTime();
    expect(refreshLifetime).toBeGreaterThanOrEqual(30 * 24 * 60 * 60 * 1000 - 1000);
    expect(refreshLifetime).toBeLessThanOrEqual(30 * 24 * 60 * 60 * 1000);
  });

  it('logs in existing users, updates only the authenticated profile, and logs out', async () => {
    const phone = await createUniquePhone();
    const user = await User.create({
      name: 'کاربر آزمایشی',
      phone,
      initialBalance: 1000,
    });
    const agent = request.agent(app);
    const sent = await agent
      .post('/api/v1/auth/otp/request')
      .set('Origin', origin)
      .set('X-Forwarded-For', nextTestIp())
      .send({ phone });
    const verified = await agent
      .post('/api/v1/auth/otp/verify')
      .set('Origin', origin)
      .send({ phone, code: sent.body.data.developmentOtp });

    expect(verified.body.data.registrationRequired).toBe(false);
    expect(setCookie(verified, 'asoudeh_access')).not.toContain('Secure');
    const originalAccess = cookieHeader(verified, 'asoudeh_access');
    const replayedOtp = await request(app)
      .post('/api/v1/auth/otp/verify')
      .set('Origin', origin)
      .send({ phone, code: sent.body.data.developmentOtp });
    expect(replayedOtp.status).toBe(400);
    expect(cookieValue(verified, 'asoudeh_registration')).toBeUndefined();
    const csrf = cookieHeader(verified, 'asoudeh_csrf');

    const profile = await agent.get('/api/v1/me');
    expect(profile.status).toBe(200);
    expect(profile.body.data.profile.displayName).toBe('کاربر آزمایشی');
    expect((await request(app)
      .get('/api/v1/me')
      .set('Cookie', `asoudeh_access=${originalAccess}`)).status).toBe(200);

    const updated = await agent
      .patch('/api/v1/me/profile')
      .set('Origin', origin)
      .set('X-CSRF-Token', csrf)
      .send({
        displayName: 'نام جدید',
        birthYear: 1350,
        initialBalance: 250000,
        accessibilitySettings: { fontScale: 1.5, highContrast: true },
      });
    expect(updated.status).toBe(200);
    expect(updated.body.data.profile).toMatchObject({
      id: user.id,
      displayName: 'نام جدید',
      birthYear: 1350,
      initialBalance: 250000,
      accessibilitySettings: { fontScale: 1.5, highContrast: true },
    });

    const invalidUpdate = await agent
      .patch('/api/v1/me/profile')
      .set('Origin', origin)
      .set('X-CSRF-Token', csrf)
      .send({ initialBalance: -1 });
    expect(invalidUpdate.status).toBe(400);

    const logout = await agent
      .post('/api/v1/auth/logout')
      .set('Origin', origin)
      .set('X-CSRF-Token', csrf);
    expect(logout.status).toBe(200);
    expect(setCookie(logout, 'asoudeh_access')).toContain('Max-Age=0');
    const storedSession = await AuthSession.findOne({
      tokenHash: hashAuthValue('refresh-token', cookieHeader(verified, 'asoudeh_refresh')),
    });
    expect(storedSession?.revokedAt).toBeTruthy();
    expect((await agent.get('/api/v1/me')).status).toBe(401);
    const replayedAccess = await request(app)
      .get('/api/v1/me')
      .set('Cookie', `asoudeh_access=${originalAccess}`);
    expect(replayedAccess.status).toBe(401);
  });

  it('rotates refresh tokens and revokes the entire family when an old token is reused', async () => {
    const phone = await createUniquePhone();
    await User.create({ name: 'کاربر نشست', phone, initialBalance: 0 });
    const agent = request.agent(app);
    const sent = await agent
      .post('/api/v1/auth/otp/request')
      .set('Origin', origin)
      .set('X-Forwarded-For', nextTestIp())
      .send({ phone });
    const verified = await agent
      .post('/api/v1/auth/otp/verify')
      .set('Origin', origin)
      .send({ phone, code: sent.body.data.developmentOtp });
    const oldRefresh = cookieHeader(verified, 'asoudeh_refresh');
    const csrf = cookieHeader(verified, 'asoudeh_csrf');

    const refreshed = await agent
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('X-CSRF-Token', csrf);
    expect(refreshed.status).toBe(200);
    const newRefresh = cookieHeader(refreshed, 'asoudeh_refresh');
    expect(newRefresh).not.toBe(oldRefresh);

    const oldSession = await AuthSession.findOne({
      tokenHash: hashAuthValue('refresh-token', oldRefresh),
    });
    expect(oldSession?.rotatedAt).toBeTruthy();

    const replay = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', `asoudeh_refresh=${oldRefresh}; asoudeh_csrf=${csrf}`)
      .set('X-CSRF-Token', csrf);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('REFRESH_TOKEN_REUSED');

    const family = await AuthSession.find({ familyId: oldSession?.familyId });
    expect(family.length).toBe(2);
    expect(family.every((session) => session.revokedAt)).toBe(true);
  });

  it('does not leave a refresh successor alive when logout races with rotation', async () => {
    const phone = await createUniquePhone();
    await User.create({ name: 'کاربر رقابت', phone, initialBalance: 0 });
    const agent = request.agent(app);
    const sent = await agent
      .post('/api/v1/auth/otp/request')
      .set('Origin', origin)
      .set('X-Forwarded-For', nextTestIp())
      .send({ phone });
    const verified = await agent
      .post('/api/v1/auth/otp/verify')
      .set('Origin', origin)
      .send({ phone, code: sent.body.data.developmentOtp });
    const oldRefresh = cookieHeader(verified, 'asoudeh_refresh');
    const csrf = cookieHeader(verified, 'asoudeh_csrf');
    const createSession = AuthSession.create.bind(AuthSession);
    const createSpy = vi
      .spyOn(AuthSession, 'create')
      .mockImplementation(async (...args) => {
        const successor = await createSession(...args);
        await revokeRefreshSession(oldRefresh);
        return successor;
      });

    let refreshResponse: request.Response;
    try {
      refreshResponse = await agent
        .post('/api/v1/auth/refresh')
        .set('Origin', origin)
        .set('X-CSRF-Token', csrf);
    } finally {
      createSpy.mockRestore();
    }

    expect(refreshResponse.status).toBe(401);
    const family = await AuthSession.find({
      familyId: (await AuthSession.findOne({ tokenHash: hashAuthValue('refresh-token', oldRefresh) }))
        ?.familyId,
    });
    expect(family).toHaveLength(2);
    expect(family.every((session) => session.revokedAt)).toBe(true);
  });

  it('rejects cookie-authenticated state changes without matching CSRF and Origin checks', async () => {
    const phone = await createUniquePhone();
    await User.create({ name: 'کاربر csrf', phone, initialBalance: 0 });
    const agent = request.agent(app);
    const sent = await agent
      .post('/api/v1/auth/otp/request')
      .set('Origin', origin)
      .set('X-Forwarded-For', nextTestIp())
      .send({ phone });
    const verified = await agent
      .post('/api/v1/auth/otp/verify')
      .set('Origin', origin)
      .send({ phone, code: sent.body.data.developmentOtp });

    const badCsrf = await agent
      .patch('/api/v1/me/profile')
      .set('Origin', origin)
      .set('X-CSRF-Token', 'wrong-token')
      .send({ displayName: 'نباید ذخیره شود' });
    const badOrigin = await agent
      .post('/api/v1/auth/logout')
      .set('Origin', 'https://evil.example')
      .set('X-CSRF-Token', cookieHeader(verified, 'asoudeh_csrf'));

    expect(badCsrf.status).toBe(403);
    expect(badOrigin.status).toBe(403);
    const unchangedUser = await User.findOne({ phone });
    expect(unchangedUser?.name).toBe('کاربر csrf');
  });
});
