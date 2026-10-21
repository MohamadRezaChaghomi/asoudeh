import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import { env } from '../config/env.js';
import AuthSession from '../models/AuthSession.js';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import {
  formatJalaliMonthKey,
  getCurrentJalaliMonthRange,
  getJalaliMonthRange,
} from '../utils/jalaliMonth.js';

const testMongoUri = process.env.TEST_MONGODB_URI;
const configuredMongoUri = process.env.MONGODB_URI;
const userIds: mongoose.Types.ObjectId[] = [];
const sessionIds: mongoose.Types.ObjectId[] = [];
const categoryIds: mongoose.Types.ObjectId[] = [];
const transactionIds: mongoose.Types.ObjectId[] = [];

interface TestIdentity {
  userId: string;
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

async function createIdentity(name: string): Promise<TestIdentity> {
  const user = await User.create({ name });
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

describe.skipIf(!testMongoUri || !configuredMongoUri)('Monthly reports API', () => {
  let owner: TestIdentity;
  let otherUser: TestIdentity;

  beforeAll(async () => {
    if (!isIsolatedTestUri(testMongoUri) || !isIsolatedTestUri(configuredMongoUri)) {
      throw new Error(
        'Monthly report tests require both MongoDB URIs to target local database asoudeh_test.',
      );
    }
    await connectDB(testMongoUri);
    await Promise.all([
      AuthSession.init(),
      Category.init(),
      Transaction.init(),
      User.init(),
    ]);
    owner = await createIdentity('Report owner');
    otherUser = await createIdentity('Report other user');
  }, 20_000);

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      if (transactionIds.length) {
        await Transaction.deleteMany({ _id: { $in: transactionIds } });
      }
      if (categoryIds.length) {
        await Category.deleteMany({ _id: { $in: categoryIds } });
      }
      if (sessionIds.length) {
        await AuthSession.deleteMany({ _id: { $in: sessionIds } });
      }
      if (userIds.length) {
        await User.deleteMany({ _id: { $in: userIds } });
      }
    }
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }, 20_000);

  it('returns owner-scoped exact monthly totals and category shares, excluding deleted records', async () => {
    const suffix = randomUUID();
    const firstCategory = await Category.create({
      userId: new mongoose.Types.ObjectId(owner.userId),
      name: `گزارش اول ${suffix}`,
      type: 'expense',
    });
    const secondCategory = await Category.create({
      userId: new mongoose.Types.ObjectId(owner.userId),
      name: `گزارش دوم ${suffix}`,
      type: 'expense',
    });
    const otherCategory = await Category.create({
      userId: new mongoose.Types.ObjectId(otherUser.userId),
      name: `گزارش دیگر ${suffix}`,
      type: 'expense',
    });
    categoryIds.push(firstCategory._id, secondCategory._id, otherCategory._id);

    const current = getCurrentJalaliMonthRange();
    const previous = current.month === 1
      ? getJalaliMonthRange(current.year - 1, 12)
      : getJalaliMonthRange(current.year, current.month - 1);
    const reportMonth = formatJalaliMonthKey(current.year, current.month);
    const transactions = await Transaction.insertMany([
      {
        userId: new mongoose.Types.ObjectId(owner.userId),
        type: 'income',
        amount: 200_000,
        categoryId: firstCategory._id,
        date: current.startDate,
      },
      {
        userId: new mongoose.Types.ObjectId(owner.userId),
        type: 'expense',
        amount: 50_000,
        categoryId: firstCategory._id,
        date: current.startDate,
      },
      {
        userId: new mongoose.Types.ObjectId(owner.userId),
        type: 'expense',
        amount: 25_000,
        categoryId: secondCategory._id,
        date: new Date(current.endDateExclusive.getTime() - 1),
      },
      {
        userId: new mongoose.Types.ObjectId(owner.userId),
        type: 'expense',
        amount: 25_000,
        categoryId: otherCategory._id,
        date: current.startDate,
      },
      {
        userId: new mongoose.Types.ObjectId(owner.userId),
        type: 'expense',
        amount: 100_000,
        categoryId: firstCategory._id,
        date: previous.startDate,
      },
      {
        userId: new mongoose.Types.ObjectId(owner.userId),
        type: 'expense',
        amount: 500_000,
        categoryId: secondCategory._id,
        date: current.startDate,
        deletedAt: new Date(),
      },
      {
        userId: new mongoose.Types.ObjectId(otherUser.userId),
        type: 'expense',
        amount: 800_000,
        categoryId: otherCategory._id,
        date: current.startDate,
      },
    ]);
    transactionIds.push(...transactions.map(({ _id }) => _id));

    const response = await authenticatedGet(
      `/api/v1/reports/monthly?month=${reportMonth}`,
      owner,
    );
    expect(response.status).toBe(200);
    expect(response.body.data.report).toMatchObject({
      monthKey: reportMonth,
      totals: {
        income: '200000',
        expenses: '100000',
        transactionCount: 4,
      },
      comparison: {
        previousExpenses: '100000',
        expenseChange: '0',
        expenseChangePercentage: 0,
      },
    });
    expect(response.body.data.report.expensesByCategory).toHaveLength(3);
    expect(response.body.data.report.expensesByCategory).toEqual(
      expect.arrayContaining([
      expect.objectContaining({
        categoryId: firstCategory.id,
        amount: '50000',
        sharePercentage: 50,
      }),
      expect.objectContaining({
        categoryId: secondCategory.id,
        amount: '25000',
        sharePercentage: 25,
      }),
      expect.objectContaining({
        categoryId: 'unavailable',
        categoryName: 'دسته‌بندی ناموجود',
        amount: '25000',
        sharePercentage: 25,
      }),
      ]),
    );
    expect(JSON.stringify(response.body.data.report.expensesByCategory))
      .not.toContain(otherCategory.name);
    expect(JSON.stringify(response.body.data.report.expensesByCategory))
      .not.toContain(otherCategory.id);

    const otherReport = await authenticatedGet(
      `/api/v1/reports/monthly?month=${reportMonth}`,
      otherUser,
    );
    expect(otherReport.body.data.report.totals).toMatchObject({
      income: '0',
      expenses: '800000',
      transactionCount: 1,
    });
  });

  it('requires authentication and validates the Jalali month query', async () => {
    expect((await request(app).get('/api/v1/reports/monthly?month=07-1405')).status).toBe(401);
    const invalid = await authenticatedGet(
      '/api/v1/reports/monthly?month=13-1405',
      owner,
    );
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('compares report totals across the Solar Hijri year boundary', async () => {
    const previous = getJalaliMonthRange(1404, 12);
    const current = getJalaliMonthRange(1405, 1);
    const category = await Category.create({
      userId: new mongoose.Types.ObjectId(owner.userId),
      name: `Year boundary ${randomUUID()}`,
      type: 'expense',
    });
    categoryIds.push(category._id);
    const transactions = await Transaction.insertMany([
      {
        userId: new mongoose.Types.ObjectId(owner.userId),
        type: 'expense',
        amount: 70_000,
        categoryId: category._id,
        date: new Date(previous.endDateExclusive.getTime() - 1),
      },
      {
        userId: new mongoose.Types.ObjectId(owner.userId),
        type: 'expense',
        amount: 20_000,
        categoryId: category._id,
        date: current.startDate,
      },
      {
        userId: new mongoose.Types.ObjectId(owner.userId),
        type: 'expense',
        amount: 99_000,
        categoryId: category._id,
        date: current.endDateExclusive,
      },
    ]);
    transactionIds.push(...transactions.map(({ _id }) => _id));

    const response = await authenticatedGet('/api/v1/reports/monthly?month=01-1405', owner);
    expect(response.status).toBe(200);
    expect(response.body.data.report).toMatchObject({
      monthKey: '01-1405',
      totals: { expenses: '20000', transactionCount: 1 },
      comparison: {
        previousMonthKey: '12-1404',
        previousExpenses: '70000',
        expenseChange: '-50000',
        expenseChangePercentage: -71.4,
      },
    });
  });
});
