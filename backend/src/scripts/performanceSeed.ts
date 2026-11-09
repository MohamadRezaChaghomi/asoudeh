import mongoose from 'mongoose';
import AuthSession from '../models/AuthSession.js';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { connectPerformanceDatabase } from './performanceSafety.js';

const PERF_EMAIL = 'performance-seed@asoudeh.invalid';
const DEFAULT_COUNT = 50_000;
const BATCH_SIZE = 1_000;

function requestedCount(): number {
  const count = Number(process.argv[2] ?? DEFAULT_COUNT);
  if (!Number.isSafeInteger(count) || count < 1 || count > 100_000) {
    throw new Error('Transaction count must be an integer from 1 to 100000.');
  }
  return count;
}

async function seed(): Promise<void> {
  await connectPerformanceDatabase();
  try {
    await Promise.all([
      User.createIndexes(),
      Category.createIndexes(),
      Transaction.createIndexes(),
      AuthSession.createIndexes(),
    ]);

    const previous = await User.findOne({ email: PERF_EMAIL }).select('_id').lean();
    if (previous) {
      await Promise.all([
        Transaction.deleteMany({ userId: previous._id }),
        Category.deleteMany({ userId: previous._id }),
        AuthSession.deleteMany({ userId: previous._id }),
      ]);
      await User.deleteOne({ _id: previous._id, email: PERF_EMAIL });
    }

    const user = await User.create({
      name: 'Performance seed (local test only)',
      email: PERF_EMAIL,
      role: 'senior',
      initialBalance: 1_000_000,
    });
    const categorySpecs = [
      { name: 'Performance income', type: 'income' as const },
      { name: 'Performance expense 1', type: 'expense' as const },
      { name: 'Performance expense 2', type: 'expense' as const },
      { name: 'Performance expense 3', type: 'expense' as const },
    ];
    const categories = await Category.insertMany(
      categorySpecs.map((category) => ({
        ...category,
        userId: user._id,
        icon: 'wallet',
        isActive: true,
      })),
    );
    const count = requestedCount();
    const start = Date.now();
    const dayInMs = 86_400_000;

    for (let offset = 0; offset < count; offset += BATCH_SIZE) {
      const batch = Array.from(
        { length: Math.min(BATCH_SIZE, count - offset) },
        (_, index) => {
          const sequence = offset + index;
          const type = sequence % 5 === 0 ? 'income' : 'expense';
          const category = type === 'income'
            ? categories[0]
            : categories[1 + (sequence % (categories.length - 1))];
          return {
            userId: user._id,
            type,
            amount: 10_000 + (sequence % 100_000),
            categoryId: category._id,
            date: new Date(Date.now() - (sequence % 730) * dayInMs),
            note: `performance-fixture-${sequence}`,
            deletedAt: null,
          };
        },
      );
      await Transaction.insertMany(batch, { ordered: true });
    }

    console.log(JSON.stringify({
      database: 'asoudeh_test',
      seededTransactions: count,
      seedDurationMs: Date.now() - start,
      fixtureUserEmail: PERF_EMAIL,
    }));
  } finally {
    await mongoose.disconnect();
  }
}

seed().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Performance seed failed.');
  process.exitCode = 1;
});
