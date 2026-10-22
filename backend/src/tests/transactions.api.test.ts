import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../app.js';
import { env } from '../config/env.js';
import AuthSession, { AUTH_SESSION_IDLE_TIMEOUT_MS } from '../models/AuthSession.js';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { connectDB } from '../config/db.js';
import { formatUtcDateOnly, getCurrentJalaliMonthRange } from '../utils/jalaliMonth.js';

const testMongoUri = process.env.TEST_MONGODB_URI;
const configuredMongoUri = process.env.MONGODB_URI;
const origin = env.clientUrl;
const csrfToken = 'transaction-api-test-csrf-token';
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

describe.skipIf(!testMongoUri || !configuredMongoUri)('Transaction API', () => {
  let owner: TestIdentity;
  let otherUser: TestIdentity;
  let ownedExpenseCategoryId: string;
  let ownedIncomeCategoryId: string;
  let inactiveCategoryId: string;
  let otherCategoryId: string;
  let systemExpenseCategoryId: string;
  let suffix: string;

  beforeAll(async () => {
    if (!isIsolatedTestUri(testMongoUri) || !isIsolatedTestUri(configuredMongoUri)) {
      throw new Error(
        'Transaction API tests require both MongoDB URIs to target local database asoudeh_test.',
      );
    }

    await connectDB(testMongoUri);
    await Promise.all([
      AuthSession.init(),
      Category.init(),
      Transaction.init(),
      User.init(),
    ]);

    suffix = randomUUID();
    owner = await createIdentity('Transaction test owner');
    otherUser = await createIdentity('Transaction test other user');
    const [
      expenseCategory,
      incomeCategory,
      inactiveCategory,
      otherCategory,
      systemExpenseCategory,
    ] =
      await Category.create([
        {
          userId: new mongoose.Types.ObjectId(owner.userId),
          name: `Expense ${suffix}`,
          type: 'expense',
        },
        {
          userId: new mongoose.Types.ObjectId(owner.userId),
          name: `Income ${suffix}`,
          type: 'income',
        },
        {
          userId: new mongoose.Types.ObjectId(owner.userId),
          name: `Inactive ${suffix}`,
          type: 'expense',
          isActive: false,
        },
        {
          userId: new mongoose.Types.ObjectId(otherUser.userId),
          name: `Other ${suffix}`,
          type: 'expense',
        },
        {
          userId: null,
          name: `System ${suffix}`,
          type: 'expense',
        },
      ]);
    categoryIds.push(
      expenseCategory._id,
      incomeCategory._id,
      inactiveCategory._id,
      otherCategory._id,
      systemExpenseCategory._id,
    );
    ownedExpenseCategoryId = expenseCategory.id;
    ownedIncomeCategoryId = incomeCategory.id;
    inactiveCategoryId = inactiveCategory.id;
    otherCategoryId = otherCategory.id;
    systemExpenseCategoryId = systemExpenseCategory.id;
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
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }, 20_000);

  it('creates and lists transactions for the authenticated user only', async () => {
    const response = await authenticatedMutation('post', '/api/v1/transactions', owner, {
      type: 'expense',
      amount: 125_000,
      categoryId: ownedExpenseCategoryId,
      date: '2024-05-12',
      note: `Lunch ${suffix}`,
    });
    const transaction = response.body.data.transaction as { id: string; amount: number };
    transactionIds.push(new mongoose.Types.ObjectId(transaction.id));

    expect(response.status).toBe(201);
    expect(transaction.amount).toBe(125_000);
    expect(response.body.data.transaction.categoryName).toBe(`Expense ${suffix}`);

    const ownerList = await authenticatedGet('/api/v1/transactions', owner);
    const otherUserList = await authenticatedGet('/api/v1/transactions', otherUser);

    expect(ownerList.status).toBe(200);
    expect(ownerList.body.data.pagination.pageSize).toBe(20);
    expect(ownerList.body.data.transactions.map(({ id }: { id: string }) => id)).toContain(
      transaction.id,
    );
    expect(otherUserList.status).toBe(200);
    expect(otherUserList.body.data.transactions.map(({ id }: { id: string }) => id)).not.toContain(
      transaction.id,
    );

    const systemCategoryTransaction = await authenticatedMutation(
      'post',
      '/api/v1/transactions',
      owner,
      {
        type: 'expense',
        amount: 10_000,
        categoryId: systemExpenseCategoryId,
        date: '2024-05-12',
      },
    );
    expect(systemCategoryTransaction.status).toBe(201);
    transactionIds.push(
      new mongoose.Types.ObjectId(systemCategoryTransaction.body.data.transaction.id),
    );

    const filteredList = await authenticatedGet(
      `/api/v1/transactions?categoryId=${ownedExpenseCategoryId}&from=2024-05-12&to=2024-05-12`,
      owner,
    );
    expect(filteredList.status).toBe(200);
    expect(filteredList.body.data.transactions.map(({ id }: { id: string }) => id)).toEqual([
      transaction.id,
    ]);

    const noteSearch = await authenticatedGet(
      `/api/v1/transactions?${new URLSearchParams({
        search: `Lunch ${suffix}`,
        sortBy: 'amount',
        sortOrder: 'asc',
      })}`,
      owner,
    );
    const categorySearch = await authenticatedGet(
      `/api/v1/transactions?${new URLSearchParams({ search: `Expense ${suffix}` })}`,
      owner,
    );
    const regexCharactersSearch = await authenticatedGet(
      `/api/v1/transactions?${new URLSearchParams({ search: '.*' })}`,
      owner,
    );
    expect(noteSearch.status).toBe(200);
    expect(noteSearch.body.data.transactions.map(({ id }: { id: string }) => id)).toEqual([
      transaction.id,
    ]);
    expect(categorySearch.body.data.transactions.map(({ id }: { id: string }) => id)).toEqual([
      transaction.id,
    ]);
    expect(regexCharactersSearch.body.data.transactions).toEqual([]);

    const today = formatUtcDateOnly(getCurrentJalaliMonthRange().today);
    const tehranTodayTransaction = await authenticatedMutation(
      'post',
      '/api/v1/transactions',
      owner,
      {
        type: 'expense',
        amount: 15_000,
        categoryId: ownedExpenseCategoryId,
        date: today,
      },
    );
    expect(tehranTodayTransaction.status).toBe(201);
    transactionIds.push(
      new mongoose.Types.ObjectId(tehranTodayTransaction.body.data.transaction.id),
    );
  });

  it('does not disclose another owner’s category metadata for a legacy transaction reference', async () => {
    const transaction = await Transaction.create({
      userId: new mongoose.Types.ObjectId(owner.userId),
      type: 'expense',
      amount: 5_000,
      categoryId: new mongoose.Types.ObjectId(otherCategoryId),
      date: new Date('2024-05-13T00:00:00.000Z'),
      note: `Legacy cross-owner category ${suffix}`,
    });
    transactionIds.push(transaction._id);

    const response = await authenticatedGet('/api/v1/transactions', owner);
    expect(response.status).toBe(200);
    const listed = response.body.data.transactions.find(
      (item: { id: string }) => item.id === transaction.id,
    );
    expect(listed).toMatchObject({
      id: transaction.id,
      amount: 5_000,
      categoryName: 'دسته‌بندی ناموجود',
      categoryIcon: 'wallet',
    });
    expect(JSON.stringify(listed)).not.toContain(`Other ${suffix}`);
  });

  it('returns stable pages of twenty transactions with pagination metadata', async () => {
    const paginationCategory = await Category.create({
      userId: new mongoose.Types.ObjectId(owner.userId),
      name: `Pagination ${suffix}`,
      type: 'expense',
    });
    categoryIds.push(paginationCategory._id);
    const created = await Transaction.create(
      Array.from({ length: 45 }, (_, index) => ({
        userId: new mongoose.Types.ObjectId(owner.userId),
        type: 'expense',
        amount: 100 + index,
        categoryId: paginationCategory._id,
        date: new Date('2024-05-12T00:00:00.000Z'),
      })),
    );
    transactionIds.push(...created.map(({ _id }) => _id));

    const firstPage = await authenticatedGet(
      `/api/v1/transactions?categoryId=${paginationCategory.id}&page=1&pageSize=20`,
      owner,
    );
    const secondPage = await authenticatedGet(
      `/api/v1/transactions?categoryId=${paginationCategory.id}&page=2&pageSize=20`,
      owner,
    );
    const lastPage = await authenticatedGet(
      `/api/v1/transactions?categoryId=${paginationCategory.id}&page=3&pageSize=20`,
      owner,
    );
    const ascendingAmountPage = await authenticatedGet(
      `/api/v1/transactions?categoryId=${paginationCategory.id}&sortBy=amount&sortOrder=asc`,
      owner,
    );
    const descendingAmountPage = await authenticatedGet(
      `/api/v1/transactions?categoryId=${paginationCategory.id}&sortBy=amount&sortOrder=desc`,
      owner,
    );
    const outOfRangePage = await authenticatedGet(
      `/api/v1/transactions?categoryId=${paginationCategory.id}&page=4&pageSize=20`,
      owner,
    );
    const emptyResult = await authenticatedGet(
      `/api/v1/transactions?categoryId=${new mongoose.Types.ObjectId()}`,
      owner,
    );

    expect(firstPage.status).toBe(200);
    expect(firstPage.body.data.transactions).toHaveLength(20);
    expect(firstPage.body.data.pagination).toEqual({
      page: 1,
      pageSize: 20,
      totalItems: 45,
      totalPages: 3,
    });
    expect(secondPage.body.data.transactions).toHaveLength(20);
    expect(secondPage.body.data.pagination.page).toBe(2);
    expect(lastPage.body.data.transactions).toHaveLength(5);
    expect(lastPage.body.data.pagination).toEqual({
      page: 3,
      pageSize: 20,
      totalItems: 45,
      totalPages: 3,
    });
    expect(outOfRangePage.body.data.transactions).toEqual([]);
    expect(outOfRangePage.body.data.pagination).toEqual({
      page: 4,
      pageSize: 20,
      totalItems: 45,
      totalPages: 3,
    });
    expect(emptyResult.body.data.transactions).toEqual([]);
    expect(emptyResult.body.data.pagination).toEqual({
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 0,
    });
    expect(
      firstPage.body.data.transactions.map(({ id }: { id: string }) => id),
    ).not.toContain(secondPage.body.data.transactions[0].id);
    const firstPageIds = firstPage.body.data.transactions.map(({ id }: { id: string }) => id);
    expect(firstPageIds).toEqual([...firstPageIds].sort((left, right) => right.localeCompare(left)));
    expect(
      firstPageIds[firstPageIds.length - 1].localeCompare(
        secondPage.body.data.transactions[0].id,
      ),
    ).toBeGreaterThan(0);
    expect(ascendingAmountPage.body.data.transactions.map(
      ({ amount }: { amount: number }) => amount,
    )).toEqual(Array.from({ length: 20 }, (_, index) => 100 + index));
    expect(descendingAmountPage.body.data.transactions.map(
      ({ amount }: { amount: number }) => amount,
    )).toEqual(Array.from({ length: 20 }, (_, index) => 144 - index));

    const oversizedPage = await authenticatedGet(
      `/api/v1/transactions?categoryId=${paginationCategory.id}&pageSize=101`,
      owner,
    );
    const unboundedPage = await authenticatedGet(
      `/api/v1/transactions?categoryId=${paginationCategory.id}&page=10001`,
      owner,
    );
    const invalidPage = await authenticatedGet(
      `/api/v1/transactions?categoryId=${paginationCategory.id}&page=0`,
      owner,
    );
    const invalidSort = await authenticatedGet(
      `/api/v1/transactions?categoryId=${paginationCategory.id}&sortBy=owner`,
      owner,
    );
    const oversizedSearch = await authenticatedGet(
      `/api/v1/transactions?search=${'x'.repeat(101)}`,
      owner,
    );
    expect(oversizedPage.status).toBe(400);
    expect(unboundedPage.status).toBe(400);
    expect(invalidPage.status).toBe(400);
    expect(invalidSort.status).toBe(400);
    expect(oversizedSearch.status).toBe(400);
  });

  it('rejects invalid amounts, types, dates, and unavailable or incompatible categories', async () => {
    const validBody = {
      type: 'expense',
      amount: 500,
      categoryId: ownedExpenseCategoryId,
      date: '2024-05-12',
    };
    const invalidBodies: Array<Record<string, unknown>> = [
      { ...validBody, amount: 0 },
      { ...validBody, amount: 1.5 },
      { ...validBody, amount: 1_000_000_000_001 },
      { ...validBody, type: 'transfer' },
      { ...validBody, date: '2024-02-30' },
      { ...validBody, date: 'not-a-date' },
      { ...validBody, date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10) },
    ];

    for (const body of invalidBodies) {
      const response = await authenticatedMutation(
        'post',
        '/api/v1/transactions',
        owner,
        body,
      );
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }

    const invalidCategoryIds = [
      new mongoose.Types.ObjectId().toString(),
      otherCategoryId,
      inactiveCategoryId,
    ];
    for (const categoryId of invalidCategoryIds) {
      const response = await authenticatedMutation('post', '/api/v1/transactions', owner, {
        ...validBody,
        categoryId,
      });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('CATEGORY_UNAVAILABLE');
    }

    const incompatibleCategory = await authenticatedMutation(
      'post',
      '/api/v1/transactions',
      owner,
      { ...validBody, categoryId: ownedIncomeCategoryId },
    );
    expect(incompatibleCategory.status).toBe(400);
    expect(incompatibleCategory.body.error.code).toBe('CATEGORY_TYPE_MISMATCH');
  });

  it('requires authentication and rejects client-supplied owners and invalid identifiers', async () => {
    const unauthenticatedGet = await request(app).get('/api/v1/transactions');
    const unauthenticatedPost = await request(app)
      .post('/api/v1/transactions')
      .set('Origin', origin)
      .set('Cookie', `asoudeh_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({});
    const unauthenticatedRestore = await request(app)
      .post(`/api/v1/transactions/${new mongoose.Types.ObjectId()}/restore`)
      .set('Origin', origin)
      .set('Cookie', `asoudeh_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken);
    expect(unauthenticatedGet.status).toBe(401);
    expect(unauthenticatedPost.status).toBe(401);
    expect(unauthenticatedRestore.status).toBe(401);

    const invalidQuery = await authenticatedGet(
      '/api/v1/transactions?type=transfer',
      owner,
    );
    expect(invalidQuery.status).toBe(400);
    expect(invalidQuery.body.error.code).toBe('VALIDATION_ERROR');

    const ownerInjection = await authenticatedMutation(
      'post',
      '/api/v1/transactions',
      owner,
      {
        type: 'expense',
        amount: 500,
        categoryId: ownedExpenseCategoryId,
        date: '2024-05-12',
        userId: otherUser.userId,
      },
    );
    expect(ownerInjection.status).toBe(400);
    expect(ownerInjection.body.error.code).toBe('VALIDATION_ERROR');

    const invalidId = await authenticatedMutation(
      'patch',
      '/api/v1/transactions/not-an-id',
      owner,
      { amount: 700 },
    );
    expect(invalidId.status).toBe(400);

    const invalidRestoreId = await authenticatedMutation(
      'post',
      '/api/v1/transactions/not-an-id/restore',
      owner,
    );
    expect(invalidRestoreId.status).toBe(400);
  });

  it('updates and soft-deletes only the owner transaction', async () => {
    const created = await authenticatedMutation('post', '/api/v1/transactions', owner, {
      type: 'income',
      amount: 250_000,
      categoryId: ownedIncomeCategoryId,
      date: '2024-05-12',
      note: `Before ${suffix}`,
    });
    const transactionId = created.body.data.transaction.id as string;
    transactionIds.push(new mongoose.Types.ObjectId(transactionId));

    const forbiddenUpdate = await authenticatedMutation(
      'patch',
      `/api/v1/transactions/${transactionId}`,
      otherUser,
      { amount: 300_000 },
    );
    const forbiddenDelete = await authenticatedMutation(
      'delete',
      `/api/v1/transactions/${transactionId}`,
      otherUser,
    );
    expect(forbiddenUpdate.status).toBe(404);
    expect(forbiddenDelete.status).toBe(404);

    const inactiveCategoryUpdate = await authenticatedMutation(
      'patch',
      `/api/v1/transactions/${transactionId}`,
      owner,
      { categoryId: inactiveCategoryId },
    );
    expect(inactiveCategoryUpdate.status).toBe(400);
    expect(inactiveCategoryUpdate.body.error.code).toBe('CATEGORY_UNAVAILABLE');

    const updated = await authenticatedMutation(
      'patch',
      `/api/v1/transactions/${transactionId}`,
      owner,
      { amount: 300_000, note: `After ${suffix}` },
    );
    expect(updated.status).toBe(200);
    expect(updated.body.data.transaction.amount).toBe(300_000);
    expect(updated.body.data.transaction.note).toBe(`After ${suffix}`);

    await Category.updateOne(
      { _id: new mongoose.Types.ObjectId(ownedIncomeCategoryId) },
      { $set: { isActive: false } },
    );
    const updatedWithInactiveExistingCategory = await authenticatedMutation(
      'patch',
      `/api/v1/transactions/${transactionId}`,
      owner,
      { amount: 325_000 },
    );
    expect(updatedWithInactiveExistingCategory.status).toBe(200);
    expect(updatedWithInactiveExistingCategory.body.data.transaction.amount).toBe(325_000);

    const deleted = await authenticatedMutation(
      'delete',
      `/api/v1/transactions/${transactionId}`,
      owner,
    );
    const repeatedDelete = await authenticatedMutation(
      'delete',
      `/api/v1/transactions/${transactionId}`,
      owner,
    );
    const listAfterDelete = await authenticatedGet('/api/v1/transactions', owner);
    const forbiddenRestore = await authenticatedMutation(
      'post',
      `/api/v1/transactions/${transactionId}/restore`,
      otherUser,
    );
    const restored = await authenticatedMutation(
      'post',
      `/api/v1/transactions/${transactionId}/restore`,
      owner,
    );
    const repeatedRestore = await authenticatedMutation(
      'post',
      `/api/v1/transactions/${transactionId}/restore`,
      owner,
    );
    const listAfterRestore = await authenticatedGet('/api/v1/transactions', owner);
    const deleteAgain = await authenticatedMutation(
      'delete',
      `/api/v1/transactions/${transactionId}`,
      owner,
    );
    await Transaction.updateOne(
      { _id: new mongoose.Types.ObjectId(transactionId) },
      { $set: { deletedAt: new Date(Date.now() - 11_000) } },
    );
    const expiredRestore = await authenticatedMutation(
      'post',
      `/api/v1/transactions/${transactionId}/restore`,
      owner,
    );
    const getDeletedByUpdate = await authenticatedMutation(
      'patch',
      `/api/v1/transactions/${transactionId}`,
      owner,
      { amount: 350_000 },
    );
    expect(deleted.status).toBe(200);
    expect(repeatedDelete.status).toBe(404);
    expect(Date.parse(deleted.body.data.undoExpiresAt)).toBe(
      Date.parse(deleted.body.data.deletedAt) + 10_000,
    );
    expect(listAfterDelete.body.data.transactions.map(({ id }: { id: string }) => id)).not.toContain(
      transactionId,
    );
    expect(forbiddenRestore.status).toBe(404);
    expect(restored.status).toBe(200);
    expect(repeatedRestore.status).toBe(404);
    expect(listAfterRestore.body.data.transactions.map(({ id }: { id: string }) => id)).toContain(
      transactionId,
    );
    expect(deleteAgain.status).toBe(200);
    expect(expiredRestore.status).toBe(410);
    expect(expiredRestore.body.error.code).toBe('TRANSACTION_UNDO_EXPIRED');
    expect(getDeletedByUpdate.status).toBe(404);
  });

  it('enforces Origin and CSRF checks for state-changing operations', async () => {
    const invalidOrigin = await authenticatedMutation(
      'post',
      '/api/v1/transactions',
      owner,
      {
        type: 'expense',
        amount: 500,
        categoryId: ownedExpenseCategoryId,
        date: '2024-05-12',
      },
      'https://invalid.example',
    );
    const invalidCsrf = await authenticatedMutation(
      'post',
      '/api/v1/transactions',
      owner,
      {
        type: 'expense',
        amount: 500,
        categoryId: ownedExpenseCategoryId,
        date: '2024-05-12',
      },
      origin,
      'invalid-csrf-token',
    );

    expect(invalidOrigin.status).toBe(403);
    expect(invalidCsrf.status).toBe(403);
  });
});
