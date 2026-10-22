import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import { env } from '../config/env.js';
import AuditLog from '../models/AuditLog.js';
import AuthSession, { AUTH_SESSION_IDLE_TIMEOUT_MS } from '../models/AuthSession.js';
import CaregiverLink from '../models/CaregiverLink.js';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { getCurrentJalaliMonthRange, formatJalaliMonthKey } from '../utils/jalaliMonth.js';

const testMongoUri = process.env.TEST_MONGODB_URI;
const configuredMongoUri = process.env.MONGODB_URI;
const csrfToken = 'caregiver-api-test-csrf-token';
const userIds: mongoose.Types.ObjectId[] = [];
const sessionIds: mongoose.Types.ObjectId[] = [];
const linkIds: mongoose.Types.ObjectId[] = [];
const categoryIds: mongoose.Types.ObjectId[] = [];
const transactionIds: mongoose.Types.ObjectId[] = [];

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

function uniquePhone(): string {
  return `09${randomInt(0, 1_000_000_000).toString().padStart(9, '0')}`;
}

async function createIdentity(name: string): Promise<TestIdentity> {
  const phone = uniquePhone();
  const user = await User.create({ name, phone });
  userIds.push(user._id);
  const session = await AuthSession.create({
    userId: user._id,
    familyId: randomUUID(),
    tokenHash: randomBytes(32).toString('hex'),
    expiresAt: new Date(Date.now() + 60_000),
    idleExpiresAt: new Date(Date.now() + AUTH_SESSION_IDLE_TIMEOUT_MS),
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

function authenticatedGet(path: string, identity: TestIdentity) {
  return request(app)
    .get(path)
    .set('Cookie', `asoudeh_access=${identity.accessToken}`);
}

function authenticatedMutation(
  method: 'post' | 'patch' | 'delete',
  path: string,
  identity: TestIdentity,
  body?: Record<string, unknown>,
) {
  const req = request(app)[method](path)
    .set('Origin', env.clientUrl)
    .set(
      'Cookie',
      `asoudeh_access=${identity.accessToken}; asoudeh_csrf=${csrfToken}`,
    )
    .set('X-CSRF-Token', csrfToken);
  return body ? req.send(body) : req;
}

describe.skipIf(!testMongoUri || !configuredMongoUri)('Caregiver API', () => {
  let senior: TestIdentity;
  let caregiver: TestIdentity;
  let otherUser: TestIdentity;
  let monthKey: string;
  let transactionCategoryId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    if (!isIsolatedTestUri(testMongoUri) || !isIsolatedTestUri(configuredMongoUri)) {
      throw new Error(
        'Caregiver API tests require both MongoDB URIs to target local database asoudeh_test.',
      );
    }
    await connectDB(testMongoUri);
    await Promise.all([
      AuditLog.init(),
      AuthSession.init(),
      CaregiverLink.init(),
      Category.init(),
      Transaction.init(),
      User.init(),
    ]);
    const indexes = await CaregiverLink.collection.indexes();
    expect(indexes).toContainEqual(
      expect.objectContaining({
        name: 'active_caregiver_phone_unique',
        unique: true,
      }),
    );
    senior = await createIdentity('Caregiver test senior');
    caregiver = await createIdentity('Caregiver test invitee');
    otherUser = await createIdentity('Caregiver test other user');
    const category = await Category.create({
      userId: new mongoose.Types.ObjectId(senior.userId),
      name: `Caregiver ${randomUUID()}`,
      type: 'expense',
    });
    transactionCategoryId = category._id;
    categoryIds.push(category._id);
    const current = getCurrentJalaliMonthRange();
    monthKey = formatJalaliMonthKey(current.year, current.month);
    const transaction = await Transaction.create({
      userId: new mongoose.Types.ObjectId(senior.userId),
      type: 'expense',
      amount: 10_000,
      categoryId: transactionCategoryId,
      date: current.today,
    });
    transactionIds.push(transaction._id);
  }, 20_000);

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      if (userIds.length) await AuditLog.deleteMany({ actorId: { $in: userIds } });
      if (linkIds.length) await CaregiverLink.deleteMany({ _id: { $in: linkIds } });
      if (transactionIds.length) await Transaction.deleteMany({ _id: { $in: transactionIds } });
      if (categoryIds.length) await Category.deleteMany({ _id: { $in: categoryIds } });
      if (sessionIds.length) await AuthSession.deleteMany({ _id: { $in: sessionIds } });
      if (userIds.length) await User.deleteMany({ _id: { $in: userIds } });
    }
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }, 20_000);

  it('requires explicit acceptance and enforces selected permissions on read-only endpoints', async () => {
    const invite = await authenticatedMutation(
      'post',
      '/api/v1/caregiver/links',
      senior,
      {
        phone: caregiver.phone,
        permissions: ['VIEW_SUMMARY', 'VIEW_TRANSACTIONS', 'VIEW_REPORTS'],
      },
    );
    expect(invite.status).toBe(201);
    const inviteId = invite.body.data.invitation.id as string;
    linkIds.push(new mongoose.Types.ObjectId(inviteId));
    expect(invite.body.data.invitation).toMatchObject({
      caregiverPhone: caregiver.phone,
      status: 'pending',
      permissions: ['VIEW_SUMMARY', 'VIEW_TRANSACTIONS', 'VIEW_REPORTS'],
    });

    expect(
      (await authenticatedGet('/api/v1/caregiver/invitations', otherUser))
        .body.data.invitations,
    ).toEqual([]);
    const incoming = await authenticatedGet('/api/v1/caregiver/invitations', caregiver);
    expect(incoming.body.data.invitations[0]).toMatchObject({
      id: inviteId,
      seniorName: 'Caregiver test senior',
    });
    expect(
      (await authenticatedMutation('patch', `/api/v1/caregiver/invitations/${inviteId}`, otherUser, {
        decision: 'accept',
      })).status,
    ).toBe(404);

    const accepted = await authenticatedMutation(
      'patch',
      `/api/v1/caregiver/invitations/${inviteId}`,
      caregiver,
      { decision: 'accept' },
    );
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.invitation.status).toBe('active');

    const summary = await authenticatedGet(
      `/api/v1/caregiver/seniors/${senior.userId}/summary`,
      caregiver,
    );
    expect(summary.status).toBe(200);
    expect(summary.body.data.summary.balance.expenses).toBe('10000');
    expect(summary.body.data.summary).not.toHaveProperty('recentTransactions');

    const transactions = await authenticatedGet(
      `/api/v1/caregiver/seniors/${senior.userId}/transactions?pageSize=5`,
      caregiver,
    );
    expect(transactions.status).toBe(200);
    expect(transactions.body.data.transactions).toHaveLength(1);

    const report = await authenticatedGet(
      `/api/v1/caregiver/seniors/${senior.userId}/reports/monthly?month=${monthKey}`,
      caregiver,
    );
    expect(report.status).toBe(200);
    expect(report.body.data.report.totals.expenses).toBe('10000');
    const caregiverAuditEntries = await AuditLog.find({
      actorId: new mongoose.Types.ObjectId(caregiver.userId),
      targetUserId: new mongoose.Types.ObjectId(senior.userId),
    }).lean();
    expect(caregiverAuditEntries.map(({ action }) => action)).toEqual(
      expect.arrayContaining([
        'caregiver.accepted',
        'caregiver.summary_viewed',
        'caregiver.transactions_viewed',
        'caregiver.report_viewed',
      ]),
    );
    expect(
      caregiverAuditEntries.every(
        (entry) =>
          !Object.keys(entry).some((field) =>
            /phone|amount|note|transaction/i.test(field),
          ),
      ),
    ).toBe(true);

    const revoke = await authenticatedMutation(
      'delete',
      `/api/v1/caregiver/links/${inviteId}`,
      senior,
    );
    expect(revoke.status).toBe(200);
    const repeatedRevoke = await authenticatedMutation(
      'delete',
      `/api/v1/caregiver/links/${inviteId}`,
      senior,
    );
    expect(repeatedRevoke.status).toBe(200);
    expect(
      await AuditLog.countDocuments({
        actorId: new mongoose.Types.ObjectId(senior.userId),
        targetUserId: new mongoose.Types.ObjectId(senior.userId),
        action: 'caregiver.revoked',
      }),
    ).toBe(1);
    expect(
      (await authenticatedGet(
        `/api/v1/caregiver/seniors/${senior.userId}/summary`,
        caregiver,
      )).status,
    ).toBe(404);
    expect(
      (await authenticatedGet(
        `/api/v1/caregiver/seniors/${senior.userId}/transactions`,
        caregiver,
      )).status,
    ).toBe(404);
    expect(
      (await authenticatedGet(
        `/api/v1/caregiver/seniors/${senior.userId}/reports/monthly?month=${monthKey}`,
        caregiver,
      )).status,
    ).toBe(404);
  });

  it('rejects self-invites, duplicate active invitations, and ungranted access', async () => {
    const selfInvite = await authenticatedMutation(
      'post',
      '/api/v1/caregiver/links',
      senior,
      { phone: senior.phone, permissions: ['VIEW_SUMMARY'] },
    );
    expect(selfInvite.status).toBe(400);

    const invitee = await createIdentity('Summary-only caregiver');
    const concurrentInvites = await Promise.all([
      authenticatedMutation('post', '/api/v1/caregiver/links', senior, {
        phone: invitee.phone,
        permissions: ['VIEW_SUMMARY'],
      }),
      authenticatedMutation('post', '/api/v1/caregiver/links', senior, {
        phone: invitee.phone,
        permissions: ['VIEW_REPORTS'],
      }),
    ]);
    expect(concurrentInvites.map(({ status }) => status).sort()).toEqual([201, 409]);
    const create = concurrentInvites.find(({ status }) => status === 201);
    if (!create) throw new Error('Concurrent invite did not create a pending invitation.');
    const invitationId = create.body.data.invitation.id as string;
    linkIds.push(new mongoose.Types.ObjectId(invitationId));
    expect(
      await AuditLog.countDocuments({
        actorId: new mongoose.Types.ObjectId(senior.userId),
        targetUserId: new mongoose.Types.ObjectId(senior.userId),
        action: 'caregiver.invited',
      }),
    ).toBe(2);

    for (const path of [
      `/api/v1/caregiver/seniors/${senior.userId}/summary`,
      `/api/v1/caregiver/seniors/${senior.userId}/transactions`,
      `/api/v1/caregiver/seniors/${senior.userId}/reports/monthly?month=${monthKey}`,
    ]) {
      expect((await authenticatedGet(path, invitee)).status).toBe(404);
    }

    const duplicate = await authenticatedMutation(
      'post',
      '/api/v1/caregiver/links',
      senior,
      { phone: invitee.phone, permissions: ['VIEW_REPORTS'] },
    );
    expect(duplicate.status).toBe(409);

    const duplicateDecisions = await Promise.all([
      authenticatedMutation(
        'patch',
        `/api/v1/caregiver/invitations/${invitationId}`,
        invitee,
        { decision: 'accept' },
      ),
      authenticatedMutation(
        'patch',
        `/api/v1/caregiver/invitations/${invitationId}`,
        invitee,
        { decision: 'accept' },
      ),
    ]);
    expect(duplicateDecisions.map(({ status }) => status).sort()).toEqual([200, 404]);
    expect(
      await AuditLog.countDocuments({
        actorId: new mongoose.Types.ObjectId(invitee.userId),
        targetUserId: new mongoose.Types.ObjectId(senior.userId),
        action: 'caregiver.accepted',
      }),
    ).toBe(1);
    expect(
      (await authenticatedGet('/api/v1/caregiver/seniors', invitee))
        .body.data.seniors,
    ).toEqual([
      expect.objectContaining({
        seniorId: senior.userId,
        permissions: ['VIEW_SUMMARY'],
      }),
    ]);
    const deniedTransactions = await authenticatedGet(
      `/api/v1/caregiver/seniors/${senior.userId}/transactions`,
      invitee,
    );
    expect(deniedTransactions.status).toBe(403);
    expect(deniedTransactions.body.error.code).toBe('CAREGIVER_PERMISSION_REQUIRED');
    expect(
      (await authenticatedGet(
        `/api/v1/caregiver/seniors/${senior.userId}/reports/monthly?month=${monthKey}`,
        invitee,
      )).status,
    ).toBe(403);
    expect(
      (await authenticatedGet(
        `/api/v1/caregiver/seniors/${senior.userId}/summary`,
        otherUser,
      )).status,
    ).toBe(404);
  });

  it('does not treat legacy active links without verified invitation consent as access', async () => {
    const legacy = await CaregiverLink.create({
      seniorId: new mongoose.Types.ObjectId(senior.userId),
      caregiverId: new mongoose.Types.ObjectId(otherUser.userId),
      status: 'active',
    });
    linkIds.push(legacy._id);
    const response = await authenticatedGet(
      `/api/v1/caregiver/seniors/${senior.userId}/summary`,
      otherUser,
    );
    expect(response.status).toBe(404);
    expect(
      (await authenticatedGet('/api/v1/caregiver/seniors', otherUser))
        .body.data.seniors,
    ).toEqual([]);
  });
});
