import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../app.js';
import { env } from '../config/env.js';
import AuthSession from '../models/AuthSession.js';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { connectDB } from '../config/db.js';
import { seedSystemCategories } from '../services/categories.service.js';

const testMongoUri = process.env.TEST_MONGODB_URI;
const configuredMongoUri = process.env.MONGODB_URI;
const origin = env.clientUrl;
const csrfToken = 'category-api-test-csrf-token';
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

function authenticatedPost(
  path: string,
  identity: TestIdentity,
  body: Record<string, unknown>,
) {
  return request(app)
    .post(path)
    .set('Origin', origin)
    .set('Cookie', `asoudeh_access=${identity.accessToken}; asoudeh_csrf=${csrfToken}`)
    .set('X-CSRF-Token', csrfToken)
    .send(body);
}

function authenticatedPatch(
  path: string,
  identity: TestIdentity,
  body: Record<string, unknown>,
  requestOrigin = origin,
  headerCsrfToken = csrfToken,
) {
  return request(app)
    .patch(path)
    .set('Origin', requestOrigin)
    .set(
      'Cookie',
      `asoudeh_access=${identity.accessToken}; asoudeh_csrf=${csrfToken}`,
    )
    .set('X-CSRF-Token', headerCsrfToken)
    .send(body);
}

function authenticatedDelete(path: string, identity: TestIdentity) {
  return request(app)
    .delete(path)
    .set('Origin', origin)
    .set('Cookie', `asoudeh_access=${identity.accessToken}; asoudeh_csrf=${csrfToken}`)
    .set('X-CSRF-Token', csrfToken);
}

describe.skipIf(!testMongoUri || !configuredMongoUri)('Category API', () => {
  let owner: TestIdentity;
  let otherUser: TestIdentity;
  let ownedCategoryId: string;
  let otherCategoryId: string;
  let systemCategoryId: string;
  let suffix: string;

  beforeAll(async () => {
    if (!isIsolatedTestUri(testMongoUri) || !isIsolatedTestUri(configuredMongoUri)) {
      throw new Error(
        'Category API tests require both MongoDB URIs to target local database asoudeh_test.',
      );
    }

    await connectDB(testMongoUri);
    await Promise.all([AuthSession.init(), Category.init(), Transaction.init(), User.init()]);

    suffix = randomUUID();
    owner = await createIdentity('Category test owner');
    otherUser = await createIdentity('Category test other user');
    const [ownedCategory, otherCategory, systemCategory] = await Category.create([
      {
        userId: new mongoose.Types.ObjectId(owner.userId),
        name: `Owned ${suffix}`,
        type: 'expense',
      },
      {
        userId: new mongoose.Types.ObjectId(otherUser.userId),
        name: `Other ${suffix}`,
        type: 'expense',
      },
      {
        userId: null,
        name: `System ${suffix}`,
        type: 'income',
      },
    ]);
    categoryIds.push(ownedCategory._id, otherCategory._id, systemCategory._id);
    ownedCategoryId = ownedCategory.id;
    otherCategoryId = otherCategory.id;
    systemCategoryId = systemCategory.id;
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

  it('lists only system categories and the authenticated user’s personal categories', async () => {
    const response = await authenticatedGet('/api/v1/categories', owner);
    const categories = response.body.data.categories as Array<{
      id: string;
      isDefault: boolean;
    }>;

    expect(response.status).toBe(200);
    expect(categories.map(({ id }) => id)).toContain(ownedCategoryId);
    expect(categories.map(({ id }) => id)).toContain(systemCategoryId);
    expect(categories.map(({ id }) => id)).not.toContain(otherCategoryId);
    expect(categories.find(({ id }) => id === systemCategoryId)?.isDefault).toBe(true);
  });

  it('creates a personal category and rejects a duplicate for the same type', async () => {
    const name = `Created ${suffix}`;
    const response = await authenticatedPost('/api/v1/categories', owner, {
      name: ` ${name} `,
      type: 'income',
    });
    const category = response.body.data.category as { id: string; name: string; isDefault: boolean };
    categoryIds.push(new mongoose.Types.ObjectId(category.id));

    expect(response.status).toBe(201);
    expect(category.name).toBe(name);
    expect(category.isDefault).toBe(false);

    const duplicate = await authenticatedPost('/api/v1/categories', owner, { name, type: 'income' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('CATEGORY_ALREADY_EXISTS');

    const otherUserCategory = await authenticatedPost('/api/v1/categories', otherUser, {
      name,
      type: 'income',
    });
    expect(otherUserCategory.status).toBe(201);
    categoryIds.push(new mongoose.Types.ObjectId(otherUserCategory.body.data.category.id));
  });

  it('updates a personal category and supports deactivation without deleting it', async () => {
    const renamed = await authenticatedPatch(
      `/api/v1/categories/${ownedCategoryId}`,
      owner,
      { name: `Renamed ${suffix}`, icon: 'custom-icon-name' },
    );
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.category.name).toBe(`Renamed ${suffix}`);
    expect(renamed.body.data.category.icon).toBe('custom-icon-name');

    const deactivated = await authenticatedPatch(
      `/api/v1/categories/${ownedCategoryId}`,
      owner,
      { isActive: false },
    );
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.data.category.isActive).toBe(false);
  });

  it('rejects category deletion explicitly without changing the category or its transaction history', async () => {
    const transaction = await Transaction.create({
      userId: new mongoose.Types.ObjectId(owner.userId),
      type: 'expense',
      amount: 4_200,
      categoryId: new mongoose.Types.ObjectId(ownedCategoryId),
      date: new Date('2024-05-12T00:00:00.000Z'),
    });
    transactionIds.push(transaction._id);

    const blocked = await authenticatedDelete(
      `/api/v1/categories/${ownedCategoryId}`,
      owner,
    );
    const categoryAfter = await Category.findById(ownedCategoryId).lean();
    const transactionAfter = await Transaction.findById(transaction._id).lean();
    const foreign = await authenticatedDelete(`/api/v1/categories/${otherCategoryId}`, owner);
    const missing = await authenticatedDelete(
      `/api/v1/categories/${new mongoose.Types.ObjectId()}`,
      owner,
    );

    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('CATEGORY_DELETION_UNAVAILABLE');
    expect(categoryAfter).not.toBeNull();
    expect(transactionAfter?.categoryId.toString()).toBe(ownedCategoryId);
    expect(transactionAfter?.userId.toString()).toBe(owner.userId);
    expect(foreign.status).toBe(404);
    expect(foreign.body.error.code).toBe('CATEGORY_NOT_FOUND');
    expect(missing.status).toBe(404);
  });

  it('seeds the defined system categories idempotently without changing personal categories', async () => {
    const defaultNames = [
      'خوراک',
      'دارو و درمان',
      'قبوض',
      'مسکن',
      'حمل‌ونقل',
      'خانواده و هدیه',
      'تفریح',
      'متفرقه',
      'حقوق',
      'کمک خانواده',
      'سایر',
    ];
    const preexisting = await Category.find({
      userId: null,
      name: { $in: defaultNames },
    })
      .select('_id')
      .lean();
    const preexistingIds = new Set(preexisting.map(({ _id }) => _id.toString()));
    const originalPersonalCategory = await Category.findById(ownedCategoryId).lean();

    await seedSystemCategories();
    const seededCategories = await Category.find({
      userId: null,
      name: { $in: defaultNames },
    })
      .sort({ type: 1, name: 1 })
      .lean();
    categoryIds.push(
      ...seededCategories
        .filter(({ _id }) => !preexistingIds.has(_id.toString()))
        .map(({ _id }) => _id),
    );
    const firstPassIds = seededCategories.map(({ _id }) => _id.toString());
    const createdByThisTest = seededCategories.find(
      ({ _id }) => !preexistingIds.has(_id.toString()),
    );

    expect(seededCategories).toHaveLength(11);
    expect(
      seededCategories.map(({ name, type }) => ({ name, type })).sort((left, right) =>
        `${left.type}:${left.name}`.localeCompare(`${right.type}:${right.name}`),
      ),
    ).toEqual(
      [
        'خوراک',
        'دارو و درمان',
        'قبوض',
        'مسکن',
        'حمل‌ونقل',
        'خانواده و هدیه',
        'تفریح',
        'متفرقه',
      ]
        .map((name) => ({ name, type: 'expense' }))
        .concat(
          ['حقوق', 'کمک خانواده', 'سایر'].map((name) => ({ name, type: 'income' })),
        )
        .sort((left, right) =>
          `${left.type}:${left.name}`.localeCompare(`${right.type}:${right.name}`),
        ),
    );
    if (createdByThisTest) {
      await Category.updateOne(
        { _id: createdByThisTest._id },
        { $set: { icon: 'custom-user-icon', isActive: false } },
      );
    }
    expect(await seedSystemCategories()).toBe(0);

    const secondPassIds = await Category.find({
      userId: null,
      name: { $in: defaultNames },
    })
      .sort({ type: 1, name: 1 })
      .select('_id')
      .lean();
    expect(secondPassIds.map(({ _id }) => _id.toString())).toEqual(firstPassIds);
    if (createdByThisTest) {
      const preserved = await Category.findById(createdByThisTest._id).lean();
      expect(preserved?.icon).toBe('custom-user-icon');
      expect(preserved?.isActive).toBe(false);
    }
    expect(await Category.findById(ownedCategoryId).lean()).toEqual(originalPersonalCategory);
  });

  it('rejects unauthenticated access and invalid category input or identifiers', async () => {
    const unauthenticated = await request(app).get('/api/v1/categories');
    const unauthenticatedDelete = await request(app)
      .delete(`/api/v1/categories/${ownedCategoryId}`)
      .set('Origin', origin)
      .set('Cookie', `asoudeh_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken);
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticatedDelete.status).toBe(401);

    const invalidName = await authenticatedPost('/api/v1/categories', owner, {
      name: 'x'.repeat(51),
      type: 'expense',
    });
    expect(invalidName.status).toBe(400);
    expect(invalidName.body.error.code).toBe('VALIDATION_ERROR');

    const invalidType = await authenticatedPost('/api/v1/categories', owner, {
      name: `Invalid ${suffix}`,
      type: 'both',
    });
    expect(invalidType.status).toBe(400);

    const clientSuppliedOwner = await authenticatedPost('/api/v1/categories', owner, {
      name: `Injected ${suffix}`,
      type: 'expense',
      userId: otherUser.userId,
    });
    expect(clientSuppliedOwner.status).toBe(400);

    const emptyUpdate = await authenticatedPatch(
      `/api/v1/categories/${ownedCategoryId}`,
      owner,
      {},
    );
    expect(emptyUpdate.status).toBe(400);

    const invalidId = await authenticatedPatch('/api/v1/categories/not-an-id', owner, {
      isActive: false,
    });
    expect(invalidId.status).toBe(400);
  });

  it('prevents cross-user and system category mutation', async () => {
    const crossUser = await authenticatedPatch(
      `/api/v1/categories/${otherCategoryId}`,
      owner,
      { isActive: false },
    );
    expect(crossUser.status).toBe(404);

    const systemMutation = await authenticatedPatch(
      `/api/v1/categories/${systemCategoryId}`,
      owner,
      { name: `Sys ${suffix}` },
    );
    expect(systemMutation.status).toBe(404);
  });

  it('retains Origin and CSRF checks for category mutations', async () => {
    const rejectedOrigin = await authenticatedPatch(
      `/api/v1/categories/${ownedCategoryId}`,
      owner,
      { isActive: false },
      'https://invalid.example',
    );
    expect(rejectedOrigin.status).toBe(403);
    expect(rejectedOrigin.body.error.code).toBe('ORIGIN_NOT_ALLOWED');

    const rejectedCsrf = await authenticatedPatch(
      `/api/v1/categories/${ownedCategoryId}`,
      owner,
      { isActive: false },
      origin,
      'different-csrf-token',
    );
    expect(rejectedCsrf.status).toBe(403);
    expect(rejectedCsrf.body.error.code).toBe('CSRF_VALIDATION_FAILED');
  });
});
