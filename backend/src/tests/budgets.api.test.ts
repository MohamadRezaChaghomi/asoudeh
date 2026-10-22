import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import { env } from '../config/env.js';
import AuthSession, { AUTH_SESSION_IDLE_TIMEOUT_MS } from '../models/AuthSession.js';
import Budget from '../models/Budget.js';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { formatUtcDateOnly, getCurrentJalaliMonthRange } from '../utils/jalaliMonth.js';

const testMongoUri = process.env.TEST_MONGODB_URI;
const configuredMongoUri = process.env.MONGODB_URI;
const origin = env.clientUrl;
const csrfToken = 'budget-api-test-csrf-token';
const userIds: mongoose.Types.ObjectId[] = [];
const sessionIds: mongoose.Types.ObjectId[] = [];
const categoryIds: mongoose.Types.ObjectId[] = [];
const budgetIds: mongoose.Types.ObjectId[] = [];
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
  requestOrigin = origin,
  headerCsrfToken = csrfToken,
) {
  const req = request(app)[method](path)
    .set('Origin', requestOrigin)
    .set(
      'Cookie',
      `asoudeh_access=${identity.accessToken}; asoudeh_csrf=${csrfToken}`,
    )
    .set('X-CSRF-Token', headerCsrfToken);
  return body ? req.send(body) : req;
}

describe.skipIf(!testMongoUri || !configuredMongoUri)('Budget API', () => {
  let owner: TestIdentity;
  let otherUser: TestIdentity;
  let suffix: string;
  let monthKey: string;
  let monthStart: Date;
  let monthEndExclusive: Date;
  let today: Date;

  beforeAll(async () => {
    if (!isIsolatedTestUri(testMongoUri) || !isIsolatedTestUri(configuredMongoUri)) {
      throw new Error(
        'Budget API tests require both MongoDB URIs to target local database asoudeh_test.',
      );
    }

    await connectDB(testMongoUri);
    await Promise.all([
      AuthSession.init(),
      Budget.init(),
      Category.init(),
      Transaction.init(),
      User.init(),
    ]);

    suffix = randomUUID();
    owner = await createIdentity('Budget test owner');
    otherUser = await createIdentity('Budget test other user');
    const range = getCurrentJalaliMonthRange();
    monthKey = `${String(range.month).padStart(2, '0')}-${range.year}`;
    monthStart = range.startDate;
    monthEndExclusive = range.endDateExclusive;
    today = range.today;
  }, 20_000);

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      if (transactionIds.length) {
        await Transaction.deleteMany({ _id: { $in: transactionIds } });
      }
      if (budgetIds.length) {
        await Budget.deleteMany({ _id: { $in: budgetIds } });
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

  async function createCategory(
    identity: TestIdentity,
    name: string,
    type: 'income' | 'expense' = 'expense',
    isActive = true,
    userId = identity.userId,
  ): Promise<string> {
    const category = await Category.create({
      userId: new mongoose.Types.ObjectId(userId),
      name: `${name.slice(0, 30)} ${suffix.slice(0, 8)}`,
      type,
      isActive,
    });
    categoryIds.push(category._id);
    return category.id;
  }

  async function createApiBudget(
    categoryId: string,
    limitAmount = 1_000,
    identity = owner,
  ): Promise<{ id: string; categoryId: string }> {
    const response = await authenticatedMutation('post', '/api/v1/budgets', identity, {
      categoryId,
      monthKey,
      limitAmount,
    });
    expect(response.status).toBe(201);
    const budget = response.body.data.budget as { id: string; categoryId: string };
    budgetIds.push(new mongoose.Types.ObjectId(budget.id));
    return budget;
  }

  it('creates one budget per personal expense category and lists only its owner’s budgets', async () => {
    const ownedCategoryId = await createCategory(owner, 'Food');
    const otherCategoryId = await createCategory(otherUser, 'Other food');
    const created = await createApiBudget(ownedCategoryId, 50_000);

    const ownerList = await authenticatedGet(
      `/api/v1/budgets?month=${monthKey}`,
      owner,
    );
    const otherList = await authenticatedGet(
      `/api/v1/budgets?month=${monthKey}`,
      otherUser,
    );

    expect(created.categoryId).toBe(ownedCategoryId);
    expect(ownerList.status).toBe(200);
    expect(ownerList.body.data.monthKey).toBe(monthKey);
    expect(ownerList.body.data.period.startDate).toBe(formatUtcDateOnly(monthStart));
    expect(ownerList.body.data.period.endDateExclusive).toBe(
      formatUtcDateOnly(monthEndExclusive),
    );
    expect(ownerList.body.data.budgets).toHaveLength(1);
    expect(ownerList.body.data.budgets[0]).toMatchObject({
      id: created.id,
      categoryId: ownedCategoryId,
      limitAmount: 50_000,
      spentAmount: '0',
      remainingAmount: '50000',
      percentageUsed: 0,
      status: 'normal',
    });
    expect(
      ownerList.body.data.budgets.map(({ categoryId: id }: { categoryId: string }) => id),
    ).not.toContain(otherCategoryId);
    expect(otherList.body.data.budgets).toEqual([]);

    const duplicate = await authenticatedMutation('post', '/api/v1/budgets', owner, {
      categoryId: ownedCategoryId,
      monthKey,
      limitAmount: 60_000,
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('BUDGET_ALREADY_EXISTS');
  });

  it('validates amount, month, category eligibility, and client-supplied ownership', async () => {
    const expenseCategoryId = await createCategory(owner, 'Valid expense');
    const incomeCategoryId = await createCategory(owner, 'Income', 'income');
    const inactiveCategoryId = await createCategory(owner, 'Inactive expense', 'expense', false);
    const otherCategoryId = await createCategory(otherUser, 'Foreign expense');
    const systemCategory = await Category.create({
      userId: null,
      name: `System ${suffix.slice(0, 8)}`,
      type: 'expense',
    });
    categoryIds.push(systemCategory._id);

    const invalidAmounts = [0, -1, 1.5, 1_000_000_000_001, Number.MAX_SAFE_INTEGER + 1];
    for (const limitAmount of invalidAmounts) {
      const response = await authenticatedMutation('post', '/api/v1/budgets', owner, {
        categoryId: expenseCategoryId,
        monthKey,
        limitAmount,
      });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }

    const invalidMonth = await authenticatedMutation('post', '/api/v1/budgets', owner, {
      categoryId: expenseCategoryId,
      monthKey: '13-1405',
      limitAmount: 1_000,
    });
    expect(invalidMonth.status).toBe(400);

    const ineligibleCategoryIds = [
      incomeCategoryId,
      inactiveCategoryId,
      otherCategoryId,
      systemCategory.id,
      new mongoose.Types.ObjectId().toString(),
    ];
    for (const categoryId of ineligibleCategoryIds) {
      const response = await authenticatedMutation('post', '/api/v1/budgets', owner, {
        categoryId,
        monthKey,
        limitAmount: 1_000,
      });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('BUDGET_CATEGORY_UNAVAILABLE');
    }

    const ownerInjection = await authenticatedMutation('post', '/api/v1/budgets', owner, {
      categoryId: expenseCategoryId,
      monthKey,
      limitAmount: 1_000,
      userId: otherUser.userId,
    });
    expect(ownerInjection.status).toBe(400);
    expect(ownerInjection.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('requires authentication, valid identifiers, valid query, Origin, and CSRF for mutations', async () => {
    const categoryId = await createCategory(owner, 'Protected');
    const budget = await createApiBudget(categoryId);

    const unauthenticatedGet = await request(app).get(
      `/api/v1/budgets?month=${monthKey}`,
    );
    const unauthenticatedPost = await request(app)
      .post('/api/v1/budgets')
      .set('Origin', origin)
      .set('Cookie', `asoudeh_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ categoryId, monthKey, limitAmount: 1_000 });
    expect(unauthenticatedGet.status).toBe(401);
    expect(unauthenticatedPost.status).toBe(401);

    const invalidQuery = await authenticatedGet('/api/v1/budgets?month=2026-10', owner);
    const unknownQuery = await authenticatedGet(
      `/api/v1/budgets?month=${monthKey}&owner=${owner.userId}`,
      owner,
    );
    expect(invalidQuery.status).toBe(400);
    expect(unknownQuery.status).toBe(400);

    const invalidId = await authenticatedMutation(
      'patch',
      '/api/v1/budgets/not-an-id',
      owner,
      { limitAmount: 2_000 },
    );
    expect(invalidId.status).toBe(400);

    const rejectedOrigin = await authenticatedMutation(
      'patch',
      `/api/v1/budgets/${budget.id}`,
      owner,
      { limitAmount: 2_000 },
      'https://invalid.example',
    );
    expect(rejectedOrigin.status).toBe(403);
    expect(rejectedOrigin.body.error.code).toBe('ORIGIN_NOT_ALLOWED');

    const rejectedCsrf = await authenticatedMutation(
      'patch',
      `/api/v1/budgets/${budget.id}`,
      owner,
      { limitAmount: 2_000 },
      origin,
      'different-csrf-token',
    );
    expect(rejectedCsrf.status).toBe(403);
    expect(rejectedCsrf.body.error.code).toBe('CSRF_VALIDATION_FAILED');
  });

  it('prevents cross-user budget reads and mutations and allows safe edit and delete', async () => {
    const categoryId = await createCategory(owner, 'Manage');
    const budget = await createApiBudget(categoryId, 25_000);

    const foreignUpdate = await authenticatedMutation(
      'patch',
      `/api/v1/budgets/${budget.id}`,
      otherUser,
      { limitAmount: 35_000 },
    );
    const foreignDelete = await authenticatedMutation(
      'delete',
      `/api/v1/budgets/${budget.id}`,
      otherUser,
    );
    expect(foreignUpdate.status).toBe(404);
    expect(foreignDelete.status).toBe(404);

    const updated = await authenticatedMutation(
      'patch',
      `/api/v1/budgets/${budget.id}`,
      owner,
      { limitAmount: 40_000 },
    );
    expect(updated.status).toBe(200);
    expect(updated.body.data.budget.limitAmount).toBe(40_000);

    await Category.updateOne(
      { _id: new mongoose.Types.ObjectId(categoryId) },
      { $set: { isActive: false } },
    );
    const editInactive = await authenticatedMutation(
      'patch',
      `/api/v1/budgets/${budget.id}`,
      owner,
      { limitAmount: 45_000 },
    );
    expect(editInactive.status).toBe(200);
    expect(editInactive.body.data.budget.categoryIsActive).toBe(false);

    const newInactiveAssignment = await authenticatedMutation(
      'patch',
      `/api/v1/budgets/${budget.id}`,
      owner,
      { categoryId: await createCategory(owner, 'Replacement') },
    );
    expect(newInactiveAssignment.status).toBe(200);
    expect(newInactiveAssignment.body.data.budget.categoryIsActive).toBe(true);

    const deleted = await authenticatedMutation(
      'delete',
      `/api/v1/budgets/${budget.id}`,
      owner,
    );
    expect(deleted.status).toBe(200);
    const listed = await authenticatedGet(`/api/v1/budgets?month=${monthKey}`, owner);
    expect(
      listed.body.data.budgets.map(({ id }: { id: string }) => id),
    ).not.toContain(budget.id);

    const repeatedDelete = await authenticatedMutation(
      'delete',
      `/api/v1/budgets/${budget.id}`,
      owner,
    );
    expect(repeatedDelete.status).toBe(404);
  });

  it('calculates expense spending by owner, category, and Jalali month and reflects transaction changes', async () => {
    const expenseCategoryId = await createCategory(owner, 'Calculation');
    const otherExpenseCategoryId = await createCategory(owner, 'Another category');
    const incomeCategoryId = await createCategory(owner, 'Calculation income', 'income');
    const budget = await createApiBudget(expenseCategoryId, 1_000);
    const previousDay = new Date(monthStart.getTime() - 86_400_000);
    const lastMonthDay = new Date(monthEndExclusive.getTime() - 86_400_000);
    const inMonth = formatUtcDateOnly(today);

    const transactions = await Transaction.insertMany([
      {
        userId: new mongoose.Types.ObjectId(owner.userId),
        type: 'expense',
        amount: 600,
        categoryId: new mongoose.Types.ObjectId(expenseCategoryId),
        date: monthStart,
      },
      {
        userId: new mongoose.Types.ObjectId(owner.userId),
        type: 'expense',
        amount: 200,
        categoryId: new mongoose.Types.ObjectId(expenseCategoryId),
        date: lastMonthDay,
      },
      {
        userId: new mongoose.Types.ObjectId(owner.userId),
        type: 'expense',
        amount: 300,
        categoryId: new mongoose.Types.ObjectId(expenseCategoryId),
        date: monthEndExclusive,
      },
      {
        userId: new mongoose.Types.ObjectId(owner.userId),
        type: 'expense',
        amount: 400,
        categoryId: new mongoose.Types.ObjectId(expenseCategoryId),
        date: previousDay,
      },
      {
        userId: new mongoose.Types.ObjectId(owner.userId),
        type: 'income',
        amount: 900,
        categoryId: new mongoose.Types.ObjectId(expenseCategoryId),
        date: today,
      },
      {
        userId: new mongoose.Types.ObjectId(owner.userId),
        type: 'expense',
        amount: 700,
        categoryId: new mongoose.Types.ObjectId(expenseCategoryId),
        date: today,
        deletedAt: new Date(),
      },
      {
        userId: new mongoose.Types.ObjectId(otherUser.userId),
        type: 'expense',
        amount: 800,
        categoryId: new mongoose.Types.ObjectId(expenseCategoryId),
        date: today,
      },
      {
        userId: new mongoose.Types.ObjectId(owner.userId),
        type: 'expense',
        amount: 500,
        categoryId: new mongoose.Types.ObjectId(otherExpenseCategoryId),
        date: today,
      },
    ]);
    transactionIds.push(...transactions.map(({ _id }) => _id));

    let listed = await authenticatedGet(`/api/v1/budgets?month=${monthKey}`, owner);
    let calculated = listed.body.data.budgets.find(
      (item: { id: string }) => item.id === budget.id,
    );
    expect(calculated).toMatchObject({
      spentAmount: '800',
      remainingAmount: '200',
      percentageUsed: 80,
      status: 'warning',
    });

    const mutable = await Transaction.create({
      userId: new mongoose.Types.ObjectId(owner.userId),
      type: 'expense',
      amount: 250,
      categoryId: new mongoose.Types.ObjectId(expenseCategoryId),
      date: new Date(`${inMonth}T00:00:00.000Z`),
    });
    transactionIds.push(mutable._id);
    const create = await authenticatedMutation('post', '/api/v1/transactions', owner, {
      type: 'expense',
      amount: 1_000,
      categoryId: expenseCategoryId,
      date: inMonth,
    });
    const createdTransactionId = create.body.data.transaction.id as string;
    transactionIds.push(new mongoose.Types.ObjectId(createdTransactionId));

    listed = await authenticatedGet(`/api/v1/budgets?month=${monthKey}`, owner);
    calculated = listed.body.data.budgets.find(
      (item: { id: string }) => item.id === budget.id,
    );
    expect(calculated).toMatchObject({
      spentAmount: '2050',
      remainingAmount: '-1050',
      percentageUsed: 205,
      status: 'exceeded',
    });

    const updateAmount = await authenticatedMutation(
      'patch',
      `/api/v1/transactions/${createdTransactionId}`,
      owner,
      { amount: 500 },
    );
    expect(updateAmount.status).toBe(200);
    let updatedList = await authenticatedGet(`/api/v1/budgets?month=${monthKey}`, owner);
    calculated = updatedList.body.data.budgets.find(
      (item: { id: string }) => item.id === budget.id,
    );
    expect(calculated.spentAmount).toBe('1550');

    const updateDate = await authenticatedMutation(
      'patch',
      `/api/v1/transactions/${createdTransactionId}`,
      owner,
      { date: formatUtcDateOnly(previousDay) },
    );
    expect(updateDate.status).toBe(200);
    updatedList = await authenticatedGet(`/api/v1/budgets?month=${monthKey}`, owner);
    calculated = updatedList.body.data.budgets.find(
      (item: { id: string }) => item.id === budget.id,
    );
    expect(calculated.spentAmount).toBe('1050');

    const updateCategory = await authenticatedMutation(
      'patch',
      `/api/v1/transactions/${createdTransactionId}`,
      owner,
      { categoryId: otherExpenseCategoryId, date: inMonth },
    );
    expect(updateCategory.status).toBe(200);
    updatedList = await authenticatedGet(`/api/v1/budgets?month=${monthKey}`, owner);
    calculated = updatedList.body.data.budgets.find(
      (item: { id: string }) => item.id === budget.id,
    );
    expect(calculated.spentAmount).toBe('1050');

    const updateType = await authenticatedMutation(
      'patch',
      `/api/v1/transactions/${createdTransactionId}`,
      owner,
      { type: 'income', categoryId: incomeCategoryId },
    );
    expect(updateType.status).toBe(200);
    updatedList = await authenticatedGet(`/api/v1/budgets?month=${monthKey}`, owner);
    calculated = updatedList.body.data.budgets.find(
      (item: { id: string }) => item.id === budget.id,
    );
    expect(calculated.spentAmount).toBe('1050');

    const deleteTransaction = await authenticatedMutation(
      'delete',
      `/api/v1/transactions/${mutable.id}`,
      owner,
    );
    expect(deleteTransaction.status).toBe(200);
    updatedList = await authenticatedGet(`/api/v1/budgets?month=${monthKey}`, owner);
    calculated = updatedList.body.data.budgets.find(
      (item: { id: string }) => item.id === budget.id,
    );
    expect(calculated.spentAmount).toBe('800');

    const restoreTransaction = await authenticatedMutation(
      'post',
      `/api/v1/transactions/${mutable.id}/restore`,
      owner,
    );
    expect(restoreTransaction.status).toBe(200);
    updatedList = await authenticatedGet(`/api/v1/budgets?month=${monthKey}`, owner);
    calculated = updatedList.body.data.budgets.find(
      (item: { id: string }) => item.id === budget.id,
    );
    expect(calculated.spentAmount).toBe('1050');

    const thresholdCategoryId = await createCategory(owner, 'Threshold');
    const thresholdBudget = await createApiBudget(thresholdCategoryId, 25_000);
    const thresholdTransaction = await Transaction.create({
      userId: new mongoose.Types.ObjectId(owner.userId),
      type: 'expense',
      amount: 24_990,
      categoryId: new mongoose.Types.ObjectId(thresholdCategoryId),
      date: today,
    });
    transactionIds.push(thresholdTransaction._id);

    const thresholdList = await authenticatedGet(
      `/api/v1/budgets?month=${monthKey}`,
      owner,
    );
    const thresholdCalculation = thresholdList.body.data.budgets.find(
      (item: { id: string }) => item.id === thresholdBudget.id,
    );
    expect(thresholdCalculation).toMatchObject({
      spentAmount: '24990',
      remainingAmount: '10',
      percentageUsed: 100,
      status: 'warning',
    });
  });
});
