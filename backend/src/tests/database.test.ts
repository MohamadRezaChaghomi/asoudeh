import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { ensureIndexes, type IndexModel } from '../utils/indexIntegrity.js';
import Budget from '../models/Budget.js';
import Category from '../models/Category.js';
import Reminder from '../models/Reminder.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';

const testMongoUri = process.env.TEST_MONGODB_URI;

function isLocalTestDatabase(uri: string | undefined): uri is string {
  if (!uri) {
    return false;
  }

  try {
    const parsedUri = new URL(uri);
    const databaseName = decodeURIComponent(parsedUri.pathname.slice(1));

    return (
      ['127.0.0.1', 'localhost'].includes(parsedUri.hostname) &&
      databaseName === 'asoudeh_test' &&
      !parsedUri.username &&
      !parsedUri.password
    );
  } catch {
    return false;
  }
}

afterEach(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

describe('MongoDB connection', () => {
  it('disables automatic index creation in production', async () => {
    const previousNodeEnv = env.nodeEnv;
    const connect = vi.spyOn(mongoose, 'connect').mockResolvedValue(mongoose);
    env.nodeEnv = 'production';

    try {
      await connectDB('mongodb://127.0.0.1:27017/asoudeh_test');
      expect(connect).toHaveBeenCalledWith(
        'mongodb://127.0.0.1:27017/asoudeh_test',
        { autoIndex: false },
      );
    } finally {
      env.nodeEnv = previousNodeEnv;
      connect.mockRestore();
    }
  });

  it('preflights every unique index before creating any index', async () => {
    const duplicate = {
      modelName: 'Category',
      indexName: 'user_type_name_unique',
      findDuplicates: async () => [{ key: { name: 'Food' }, count: 2, sampleIds: ['a', 'b'] }],
    };
    const createIndexes = vi.fn(async () => undefined);
    const report = vi.fn();
    const models: IndexModel[] = [
      { modelName: 'Category', uniqueIndexes: [duplicate], createIndexes },
      {
        modelName: 'Budget',
        uniqueIndexes: [],
        createIndexes: vi.fn(async () => undefined),
      },
    ];

    await expect(ensureIndexes(models, report)).resolves.toBe(false);
    expect(report).toHaveBeenCalledOnce();
    expect(createIndexes).not.toHaveBeenCalled();
    expect(models[1].createIndexes).not.toHaveBeenCalled();
  });

  it('creates model indexes only after all unique-index checks are clean', async () => {
    const createIndexes = vi.fn(async () => undefined);
    const models: IndexModel[] = [
      {
        modelName: 'User',
        uniqueIndexes: [
          {
            modelName: 'User',
            indexName: 'phone_unique',
            findDuplicates: async () => [],
          },
        ],
        createIndexes,
      },
    ];

    await expect(ensureIndexes(models, vi.fn())).resolves.toBe(true);
    expect(createIndexes).toHaveBeenCalledOnce();
  });

  it('enforces schema-level financial and Zod-aligned constraints', () => {
    const transaction = new Transaction({
      userId: new mongoose.Types.ObjectId(),
      type: 'expense',
      amount: 1.5,
      categoryId: new mongoose.Types.ObjectId(),
      date: new Date('2026-01-01T00:00:00.000Z'),
      note: 'x'.repeat(201),
    });
    const budget = new Budget({
      userId: new mongoose.Types.ObjectId(),
      categoryId: new mongoose.Types.ObjectId(),
      monthKey: '13-1402',
      limitAmount: 1.5,
    });
    const category = new Category({ name: '   ', type: 'income' });
    const invalidCategoryType = new Category({ name: 'Food', type: 'both' });
    const user = new User({ name: 'A', initialBalance: 1.5 });
    const reminder = new Reminder({
      userId: new mongoose.Types.ObjectId(),
      title: '   ',
      date: new Date('2026-01-01T00:00:00.000Z'),
      recurrence: 'yearly',
    });
    const reminderWithoutRecurrence = new Reminder({
      userId: new mongoose.Types.ObjectId(),
      title: 'Reminder',
      date: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(transaction.validateSync()?.errors.amount).toBeDefined();
    expect(transaction.validateSync()?.errors.note).toBeDefined();
    expect(budget.validateSync()?.errors.monthKey).toBeDefined();
    expect(budget.validateSync()?.errors.limitAmount).toBeDefined();
    expect(category.validateSync()?.errors.name).toBeDefined();
    expect(invalidCategoryType.validateSync()?.errors.type).toBeDefined();
    expect(user.validateSync()?.errors.initialBalance).toBeDefined();
    expect(reminder.validateSync()?.errors.title).toBeDefined();
    expect(reminder.validateSync()?.errors.recurrence).toBeDefined();
    expect(reminderWithoutRecurrence.validateSync()?.errors.recurrence).toBeDefined();
  });

  it.skipIf(!testMongoUri)('connects to the isolated local test database', async () => {
    if (!isLocalTestDatabase(testMongoUri)) {
      throw new Error(
        'TEST_MONGODB_URI must target local database asoudeh_test without credentials.',
      );
    }

    await connectDB(testMongoUri);
    const result = await mongoose.connection.db?.admin().ping();

    expect(mongoose.connection.name).toBe('asoudeh_test');
    expect(result?.ok).toBe(1);
  });
});
