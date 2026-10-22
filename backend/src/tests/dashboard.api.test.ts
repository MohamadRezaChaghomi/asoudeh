import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../app.js';
import { env } from '../config/env.js';
import AuthSession, { AUTH_SESSION_IDLE_TIMEOUT_MS } from '../models/AuthSession.js';
import Category from '../models/Category.js';
import Reminder from '../models/Reminder.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { connectDB } from '../config/db.js';
import {
  formatUtcDateOnly,
  getCurrentJalaliMonthRange,
} from '../utils/jalaliMonth.js';

const testMongoUri = process.env.TEST_MONGODB_URI;
const configuredMongoUri = process.env.MONGODB_URI;
const csrfToken = 'dashboard-restore-test-csrf-token';
const userIds: mongoose.Types.ObjectId[] = [];
const sessionIds: mongoose.Types.ObjectId[] = [];
const categoryIds: mongoose.Types.ObjectId[] = [];
const transactionIds: mongoose.Types.ObjectId[] = [];
const reminderIds: mongoose.Types.ObjectId[] = [];

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

async function createIdentity(
  name: string,
  initialBalance = 0,
): Promise<TestIdentity> {
  const user = await User.create({ name, initialBalance });
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
    accessToken: jwt.sign(
      { purpose: 'access', sid: session.id },
      env.jwtSecret,
      { algorithm: 'HS256', expiresIn: 900, subject: user.id },
    ),
  };
}

function authenticatedGet(identity: TestIdentity) {
  return request(app)
    .get('/api/v1/dashboard')
    .set('Cookie', `asoudeh_access=${identity.accessToken}`);
}

function authenticatedRestore(identity: TestIdentity, transactionId: string) {
  return request(app)
    .post(`/api/v1/transactions/${transactionId}/restore`)
    .set('Origin', env.clientUrl)
    .set(
      'Cookie',
      `asoudeh_access=${identity.accessToken}; asoudeh_csrf=${csrfToken}`,
    )
    .set('X-CSRF-Token', csrfToken);
}

function dateAtOffset(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

describe.skipIf(!testMongoUri || !configuredMongoUri)('Dashboard API', () => {
  let owner: TestIdentity;
  let otherUser: TestIdentity;
  let categoryId: mongoose.Types.ObjectId;
  let monthStart: Date;
  let monthEndExclusive: Date;
  let today: Date;

  beforeAll(async () => {
    if (!isIsolatedTestUri(testMongoUri) || !isIsolatedTestUri(configuredMongoUri)) {
      throw new Error(
        'Dashboard API tests require both MongoDB URIs to target local database asoudeh_test.',
      );
    }

    await connectDB(testMongoUri);
    await Promise.all([
      AuthSession.init(),
      Category.init(),
      Reminder.init(),
      Transaction.init(),
      User.init(),
    ]);

    owner = await createIdentity('Dashboard test owner', 300_000);
    otherUser = await createIdentity('Dashboard test other user');
    const category = await Category.create({
      userId: new mongoose.Types.ObjectId(owner.userId),
      name: `Dashboard ${randomUUID()}`,
      type: 'both',
    });
    categoryId = category._id;
    categoryIds.push(categoryId);

    const range = getCurrentJalaliMonthRange();
    monthStart = range.startDate;
    monthEndExclusive = range.endDateExclusive;
    today = range.today;
  }, 20_000);

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      if (transactionIds.length) {
        await Transaction.deleteMany({ _id: { $in: transactionIds } });
      }
      if (reminderIds.length) {
        await Reminder.deleteMany({ _id: { $in: reminderIds } });
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
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }, 20_000);

  it('returns exact Jalali-month totals, recent transactions, and upcoming reminders for the owner', async () => {
    const lastDayOfMonth = dateAtOffset(monthEndExclusive, -1);
    const beforeMonth = dateAtOffset(monthStart, -1);
    const afterMonth = monthEndExclusive;
    const inMonthDate = dateAtOffset(monthStart, 1);

    const transactions = await Transaction.insertMany([
      {
        userId: new mongoose.Types.ObjectId(owner.userId),
        type: 'income',
        amount: 100_000,
        categoryId,
        date: monthStart,
      },
      {
        userId: new mongoose.Types.ObjectId(owner.userId),
        type: 'expense',
        amount: 25_000,
        categoryId,
        date: lastDayOfMonth,
      },
      {
        userId: new mongoose.Types.ObjectId(owner.userId),
        type: 'expense',
        amount: 50_000,
        categoryId,
        date: beforeMonth,
      },
      {
        userId: new mongoose.Types.ObjectId(owner.userId),
        type: 'income',
        amount: 90_000,
        categoryId,
        date: afterMonth,
      },
      {
        userId: new mongoose.Types.ObjectId(owner.userId),
        type: 'income',
        amount: 70_000,
        categoryId,
        date: inMonthDate,
        deletedAt: new Date(),
      },
      ...Array.from({ length: 6 }, (_, index) => ({
        userId: new mongoose.Types.ObjectId(owner.userId),
        type: 'expense' as const,
        amount: 1_000 + index,
        categoryId,
        date: dateAtOffset(monthStart, 2 + index),
      })),
      {
        userId: new mongoose.Types.ObjectId(otherUser.userId),
        type: 'income',
        amount: 999_999,
        categoryId,
        date: inMonthDate,
      },
    ]);
    transactionIds.push(...transactions.map(({ _id }) => _id));

    const reminders = await Reminder.create([
      {
        userId: new mongoose.Types.ObjectId(owner.userId),
        title: `Soon ${randomUUID()}`,
        date: dateAtOffset(today, 7),
        recurrence: 'monthly',
      },
      {
        userId: new mongoose.Types.ObjectId(owner.userId),
        title: `Too late ${randomUUID()}`,
        date: dateAtOffset(today, 8),
      },
      {
        userId: new mongoose.Types.ObjectId(owner.userId),
        title: `Inactive ${randomUUID()}`,
        date: dateAtOffset(today, 2),
        isActive: false,
      },
      {
        userId: new mongoose.Types.ObjectId(otherUser.userId),
        title: `Other ${randomUUID()}`,
        date: dateAtOffset(today, 1),
      },
    ]);
    reminderIds.push(...reminders.map(({ _id }) => _id));

    const response = await authenticatedGet(owner);
    const { data } = response.body as {
      data: {
        period: {
          calendar: string;
          startDate: string;
          endDateExclusive: string;
        };
        balance: {
          initialBalance: number;
          income: string;
          expenses: string;
          remaining: string;
        };
        recentTransactions: Array<{ id: string }>;
        upcomingReminders: Array<{ title: string; date: string }>;
      };
    };

    expect(response.status).toBe(200);
    expect(data.period.calendar).toBe('jalali');
    expect(data.period.startDate).toBe(formatUtcDateOnly(monthStart));
    expect(data.period.endDateExclusive).toBe(formatUtcDateOnly(monthEndExclusive));
    expect(data.balance).toEqual({
      initialBalance: 300_000,
      income: '100000',
      expenses: '31015',
      remaining: '368985',
    });
    expect(data.recentTransactions).toHaveLength(5);
    expect(data.recentTransactions.map(({ id }) => id)).not.toContain(
      transactions[4].id,
    );
    expect(data.recentTransactions.map(({ id }) => id)).not.toContain(
      transactions[transactions.length - 1].id,
    );
    expect(data.upcomingReminders).toHaveLength(1);
    expect(data.upcomingReminders[0].date).toBe(formatUtcDateOnly(dateAtOffset(today, 7)));
  });

  it('returns genuine zero totals and empty collections when no records exist', async () => {
    const identity = await createIdentity('Dashboard empty user', 12_000);
    const response = await authenticatedGet(identity);

    expect(response.status).toBe(200);
    expect(response.body.data.balance).toEqual({
      initialBalance: 12_000,
      income: '0',
      expenses: '0',
      remaining: '12000',
    });
    expect(response.body.data.recentTransactions).toEqual([]);
    expect(response.body.data.upcomingReminders).toEqual([]);
  });

  it('includes a transaction in dashboard totals again after a valid undo', async () => {
    const identity = await createIdentity('Dashboard undo owner');
    const category = await Category.create({
      userId: new mongoose.Types.ObjectId(identity.userId),
      name: `Undo ${randomUUID()}`,
      type: 'income',
    });
    categoryIds.push(category._id);
    const [transaction] = await Transaction.create([
      {
        userId: new mongoose.Types.ObjectId(identity.userId),
        type: 'income',
        amount: 55_000,
        categoryId: category._id,
        date: today,
      },
    ]);
    transactionIds.push(transaction._id);

    const beforeDelete = await authenticatedGet(identity);
    expect(beforeDelete.body.data.balance.income).toBe('55000');

    await Transaction.updateOne(
      { _id: transaction._id },
      { $set: { deletedAt: new Date() } },
    );
    const afterDelete = await authenticatedGet(identity);
    expect(afterDelete.body.data.balance.income).toBe('0');

    const restored = await authenticatedRestore(identity, transaction.id);
    const afterRestore = await authenticatedGet(identity);
    expect(restored.status).toBe(200);
    expect(afterRestore.body.data.balance.income).toBe('55000');
    expect(afterRestore.body.data.recentTransactions.map(({ id }: { id: string }) => id)).toContain(
      transaction.id,
    );
  });

  it('requires authentication', async () => {
    const response = await request(app).get('/api/v1/dashboard');

    expect(response.status).toBe(401);
  });
});
