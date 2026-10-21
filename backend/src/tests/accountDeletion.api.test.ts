import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import { env } from '../config/env.js';
import AuditLog from '../models/AuditLog.js';
import AuthSession from '../models/AuthSession.js';
import Budget from '../models/Budget.js';
import CaregiverLink from '../models/CaregiverLink.js';
import Category from '../models/Category.js';
import OtpChallenge from '../models/OtpChallenge.js';
import OtpRateLimit from '../models/OtpRateLimit.js';
import Reminder from '../models/Reminder.js';
import ReminderCompletion from '../models/ReminderCompletion.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { purgeScheduledAccountDeletion } from '../services/accountDeletion.service.js';
import { hashAuthValue } from '../utils/authCrypto.js';

const testMongoUri = process.env.TEST_MONGODB_URI;
const configuredMongoUri = process.env.MONGODB_URI;
const originalNodeEnv = env.nodeEnv;
const originalSimulatorSetting = env.otpDevSimulatorEnabled;
const csrfToken = 'account-deletion-api-test-csrf-token';
const userIds: mongoose.Types.ObjectId[] = [];
const sessionIds: mongoose.Types.ObjectId[] = [];
const categoryIds: mongoose.Types.ObjectId[] = [];
const transactionIds: mongoose.Types.ObjectId[] = [];
const budgetIds: mongoose.Types.ObjectId[] = [];
const reminderIds: mongoose.Types.ObjectId[] = [];
const completionIds: mongoose.Types.ObjectId[] = [];
const caregiverLinkIds: mongoose.Types.ObjectId[] = [];
const auditLogIds: mongoose.Types.ObjectId[] = [];
const phones: string[] = [];
const testIps: string[] = [];

interface TestIdentity {
  userId: string;
  phone: string;
  accessToken: string;
}

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

function nextPhone(): string {
  const phone = `09${randomInt(0, 1_000_000_000).toString().padStart(9, '0')}`;
  phones.push(phone);
  return phone;
}

function nextIp(): string {
  const ip = `198.51.100.${randomInt(1, 255)}`;
  testIps.push(ip);
  return ip;
}

async function createIdentity(name: string): Promise<TestIdentity> {
  const phone = nextPhone();
  const user = await User.create({ name, phone, initialBalance: 0 });
  userIds.push(user._id);
  const session = await AuthSession.create({
    userId: user._id,
    familyId: randomUUID(),
    tokenHash: randomBytes(32).toString('hex'),
    expiresAt: new Date(Date.now() + 60_000),
  });
  sessionIds.push(session._id);
  return {
    userId: user.id,
    phone,
    accessToken: jwt.sign(
      { purpose: 'access', sid: session.id },
      env.jwtSecret,
      { algorithm: 'HS256', expiresIn: 900, subject: user.id },
    ),
  };
}

async function issueOtp(phone: string): Promise<string> {
  const response = await request(app)
    .post('/api/v1/auth/otp/request')
    .set('Origin', env.clientUrl)
    .set('X-Forwarded-For', nextIp())
    .send({ phone });
  expect(response.status).toBe(200);
  return response.body.data.developmentOtp as string;
}

function authenticatedDeletion(identity: TestIdentity, code: string) {
  return request(app)
    .post('/api/v1/auth/account-deletion')
    .set('Origin', env.clientUrl)
    .set(
      'Cookie',
      `asoudeh_access=${identity.accessToken}; asoudeh_csrf=${csrfToken}`,
    )
    .set('X-CSRF-Token', csrfToken)
    .send({ code });
}

describe.skipIf(!testMongoUri || !configuredMongoUri)('Account deletion API', () => {
  beforeAll(async () => {
    if (!isIsolatedTestUri(testMongoUri) || !isIsolatedTestUri(configuredMongoUri)) {
      throw new Error(
        'Account deletion tests require both MongoDB URIs to target local database asoudeh_test.',
      );
    }
    if (!env.authHashSecret) {
      throw new Error('Account deletion tests require AUTH_HASH_SECRET.');
    }

    app.set('trust proxy', true);
    await connectDB(testMongoUri);
    await Promise.all([
      AuditLog.init(),
      AuthSession.init(),
      Budget.init(),
      CaregiverLink.init(),
      Category.init(),
      OtpChallenge.init(),
      OtpRateLimit.init(),
      Reminder.init(),
      ReminderCompletion.init(),
      Transaction.init(),
      User.init(),
    ]);
    const userIndexes = await User.collection.indexes();
    expect(userIndexes).toContainEqual(
      expect.objectContaining({
        name: 'deletionScheduledAt_1',
        key: { deletionScheduledAt: 1 },
      }),
    );
  }, 20_000);

  beforeEach(() => {
    env.nodeEnv = 'development';
    env.otpDevSimulatorEnabled = true;
  });

  afterAll(async () => {
    env.nodeEnv = originalNodeEnv;
    env.otpDevSimulatorEnabled = originalSimulatorSetting;
    if (mongoose.connection.readyState === 1) {
      const userFilter = { $in: userIds };
      const phoneHashes = phones.map((phone) => hashAuthValue('phone', phone));
      const phoneRateLimitIds = phones.map((phone) =>
        hashAuthValue('otp-rate-limit', `phone\0${phone}`),
      );
      await Promise.all([
        AuditLog.deleteMany({
          $or: [{ actorId: userFilter }, { targetUserId: userFilter }],
        }),
        AuthSession.deleteMany({ userId: userFilter }),
        Budget.deleteMany({ _id: { $in: budgetIds } }),
        CaregiverLink.deleteMany({
          $or: [
            { _id: { $in: caregiverLinkIds } },
            { caregiverPhone: { $in: phones } },
          ],
        }),
        Category.deleteMany({ _id: { $in: categoryIds } }),
        OtpChallenge.deleteMany({ phoneHash: { $in: phoneHashes } }),
        OtpRateLimit.deleteMany({ _id: { $in: phoneRateLimitIds } }),
        Reminder.deleteMany({ _id: { $in: reminderIds } }),
        ReminderCompletion.deleteMany({ _id: { $in: completionIds } }),
        Transaction.deleteMany({ _id: { $in: transactionIds } }),
        User.deleteMany({ _id: userFilter }),
      ]);
    }
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }, 20_000);

  it('requires a valid OTP, schedules deletion in 30 days, and blocks future access', async () => {
    const identity = await createIdentity('Account deletion request');
    const caregiver = await createIdentity('Account deletion caregiver');
    const link = await CaregiverLink.create({
      seniorId: new mongoose.Types.ObjectId(identity.userId),
      caregiverId: new mongoose.Types.ObjectId(caregiver.userId),
      caregiverPhone: caregiver.phone,
      status: 'active',
      permissions: { readSummary: true, readTransactions: true, readReports: true },
      respondedAt: new Date(),
    });
    caregiverLinkIds.push(link._id);
    const code = await issueOtp(identity.phone);
    const wrongCode = code === '999999' ? '999998' : '999999';

    const invalid = await authenticatedDeletion(identity, wrongCode);
    expect(invalid.status).toBe(400);
    expect((await User.findById(identity.userId))?.deletionScheduledAt).toBeNull();

    const response = await authenticatedDeletion(identity, code);
    expect(response.status).toBe(200);
    expect(response.body.data.scheduledFor).toBeTruthy();
    expect(response.body.message).toContain('۳۰ روز');
    const scheduledFor = new Date(response.body.data.scheduledFor).getTime();
    expect(scheduledFor - Date.now()).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    expect(scheduledFor - Date.now()).toBeLessThanOrEqual(30 * 24 * 60 * 60 * 1000);
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('asoudeh_access=;')]),
    );

    const user = await User.findById(identity.userId).lean();
    expect(user?.deletionRequestedAt).toBeInstanceOf(Date);
    expect(user?.deletionScheduledAt?.toISOString()).toBe(response.body.data.scheduledFor);
    const session = await AuthSession.findById(sessionIds[0]).lean();
    expect(session?.revokedAt).toBeInstanceOf(Date);
    expect(
      (
        await request(app)
          .get('/api/v1/me')
          .set('Cookie', `asoudeh_access=${identity.accessToken}`)
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .get(`/api/v1/caregiver/seniors/${identity.userId}/summary`)
          .set('Cookie', `asoudeh_access=${caregiver.accessToken}`)
      ).status,
    ).toBe(404);
    const accessibleSeniors = await request(app)
      .get('/api/v1/caregiver/seniors')
      .set('Cookie', `asoudeh_access=${caregiver.accessToken}`);
    expect(accessibleSeniors.body.data.seniors).toEqual([]);

    const nextCode = await issueOtp(identity.phone);
    const pendingLogin = await request(app)
      .post('/api/v1/auth/otp/verify')
      .set('Origin', env.clientUrl)
      .send({ phone: identity.phone, code: nextCode });
    expect(pendingLogin.status).toBe(409);
    expect(pendingLogin.body.error.code).toBe('ACCOUNT_DELETION_PENDING');
  });

  it('purges all account-owned records and phone-bound invitations after the deadline', async () => {
    const identity = await createIdentity('Account deletion purge');
    const otherUser = await createIdentity('Unrelated account');
    const ownerId = new mongoose.Types.ObjectId(identity.userId);
    const otherUserId = new mongoose.Types.ObjectId(otherUser.userId);
    const category = await Category.create({
      userId: ownerId,
      name: `Purge ${randomUUID()}`,
      type: 'expense',
    });
    categoryIds.push(category._id);
    const transaction = await Transaction.create({
      userId: ownerId,
      type: 'expense',
      amount: 1000,
      categoryId: category._id,
      date: new Date('2026-01-01T00:00:00.000Z'),
    });
    transactionIds.push(transaction._id);
    const budget = await Budget.create({
      userId: ownerId,
      categoryId: category._id,
      monthKey: '01-1405',
      limitAmount: 10_000,
    });
    budgetIds.push(budget._id);
    const reminder = await Reminder.create({
      userId: ownerId,
      title: `Purge ${randomUUID()}`,
      date: new Date('2026-01-02T00:00:00.000Z'),
      recurrence: 'monthly',
    });
    reminderIds.push(reminder._id);
    const completion = await ReminderCompletion.create({
      userId: ownerId,
      reminderId: reminder._id,
      monthKey: '01-1405',
      completedAt: new Date(),
    });
    completionIds.push(completion._id);
    const link = await CaregiverLink.create({
      seniorId: otherUserId,
      caregiverPhone: identity.phone,
      status: 'pending',
      permissions: { readSummary: true, readTransactions: false, readReports: false },
    });
    caregiverLinkIds.push(link._id);
    const auditLog = await AuditLog.create({
      actorId: ownerId,
      targetUserId: otherUserId,
      action: 'caregiver.invited',
    });
    auditLogIds.push(auditLog._id);
    const session = await AuthSession.create({
      userId: ownerId,
      familyId: randomUUID(),
      tokenHash: randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + 60_000),
    });
    sessionIds.push(session._id);
    const phoneHash = hashAuthValue('phone', identity.phone);
    const rateLimitId = hashAuthValue('otp-rate-limit', `phone\0${identity.phone}`);
    await Promise.all([
      OtpChallenge.create({
        phoneHash,
        phone: identity.phone,
        deleteAt: new Date(Date.now() + 60_000),
      }),
      OtpRateLimit.create({
        _id: rateLimitId,
        requestTimes: [new Date()],
        expiresAt: new Date(Date.now() + 60_000),
      }),
    ]);
    await User.updateOne(
      { _id: ownerId },
      {
        $set: {
          deletionRequestedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
          deletionScheduledAt: new Date(Date.now() - 1000),
        },
      },
    );

    expect(await purgeScheduledAccountDeletion(ownerId)).toBe(true);
    expect(await User.exists({ _id: ownerId })).toBeNull();
    expect(await Transaction.exists({ _id: transaction._id })).toBeNull();
    expect(await Category.exists({ _id: category._id })).toBeNull();
    expect(await Budget.exists({ _id: budget._id })).toBeNull();
    expect(await Reminder.exists({ _id: reminder._id })).toBeNull();
    expect(await ReminderCompletion.exists({ _id: completion._id })).toBeNull();
    expect(await CaregiverLink.exists({ _id: link._id })).toBeNull();
    expect(await AuthSession.exists({ _id: session._id })).toBeNull();
    expect(await AuditLog.exists({ _id: auditLog._id })).toBeNull();
    expect(await OtpChallenge.exists({ phoneHash })).toBeNull();
    expect(await OtpRateLimit.exists({ _id: rateLimitId })).toBeNull();
    expect(await User.exists({ _id: otherUserId })).not.toBeNull();
  });
});
