import 'dotenv/config';
import mongoose from 'mongoose';
import Budget from '../models/Budget.js';
import CaregiverLink from '../models/CaregiverLink.js';
import Category from '../models/Category.js';
import Reminder from '../models/Reminder.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { formatJalaliMonthKey, getCurrentJalaliMonthRange } from '../utils/jalaliMonth.js';
import { validateTestUserSeedTarget } from '../utils/testUserSeedSafety.js';

const TEST_USERS = [
  {
    name: 'Demo Senior',
    email: 'demo-senior@asoudeh.invalid',
    phone: '09120000001',
    role: 'senior' as const,
    initialBalance: 10_000_000,
  },
  {
    name: 'Demo Caregiver',
    email: 'demo-caregiver@asoudeh.invalid',
    phone: '09120000002',
    role: 'caregiver' as const,
    initialBalance: 0,
  },
  {
    name: 'Demo Admin',
    email: 'demo-admin@asoudeh.invalid',
    phone: '09120000003',
    role: 'admin' as const,
    initialBalance: 0,
  },
];

const FIXTURE_NOTES = {
  income: 'release-demo:monthly-income',
  groceries: 'release-demo:grocery-expense',
  pharmacy: 'release-demo:pharmacy-expense',
};

async function seedTestUsers(): Promise<void> {
  const uri = validateTestUserSeedTarget({
    nodeEnv: process.env.NODE_ENV,
    confirmation: process.env.SEED_TEST_USERS_CONFIRMATION,
    otpSimulatorEnabled: process.env.OTP_DEV_SIMULATOR_ENABLED,
    uri: process.env.MONGODB_URI,
  });

  await mongoose.connect(uri);

  try {
    const phones = TEST_USERS.map(({ phone }) => phone);
    const emails = TEST_USERS.map(({ email }) => email);
    const conflictingUsers = await User.find({
      phone: { $in: phones },
      email: { $nin: emails },
    })
      .select('_id')
      .lean();
    if (conflictingUsers.length > 0) {
      throw new Error('A test phone is already assigned to a different account; no seed data was written.');
    }

    const users = await Promise.all(
      TEST_USERS.map(({ email, ...user }) =>
        User.findOneAndUpdate(
          { email },
          { $set: user, $setOnInsert: { email } },
          { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
        )
          .select('_id')
          .lean(),
      ),
    );
    const [senior, caregiver] = users;
    if (!senior || !caregiver) {
      throw new Error('Unable to create the demo account records.');
    }

    const [incomeCategory, groceryCategory, pharmacyCategory] = await Promise.all([
      Category.findOneAndUpdate(
        { userId: senior._id, type: 'income', name: 'درآمد ماهانه آزمایشی' },
        { $set: { icon: 'wallet', isActive: true } },
        { new: true, upsert: true, runValidators: true },
      )
        .select('_id')
        .lean(),
      Category.findOneAndUpdate(
        { userId: senior._id, type: 'expense', name: 'خرید روزانه آزمایشی' },
        { $set: { icon: 'shopping-cart', isActive: true } },
        { new: true, upsert: true, runValidators: true },
      )
        .select('_id')
        .lean(),
      Category.findOneAndUpdate(
        { userId: senior._id, type: 'expense', name: 'دارو و درمان آزمایشی' },
        { $set: { icon: 'heart', isActive: true } },
        { new: true, upsert: true, runValidators: true },
      )
        .select('_id')
        .lean(),
    ]);
    if (!incomeCategory || !groceryCategory || !pharmacyCategory) {
      throw new Error('Unable to create the demo categories.');
    }

    const month = getCurrentJalaliMonthRange();
    const monthKey = formatJalaliMonthKey(month.year, month.month);
    const dayInMs = 24 * 60 * 60 * 1000;
    const currentDayOffset = Math.floor(
      (month.today.getTime() - month.startDate.getTime()) / dayInMs,
    );
    const incomeDate = new Date(
      month.startDate.getTime() + Math.min(2, currentDayOffset) * dayInMs,
    );
    const expenseDate = new Date(month.today);
    const transactions = [
      {
        note: FIXTURE_NOTES.income,
        type: 'income' as const,
        amount: 18_000_000,
        categoryId: incomeCategory._id,
        date: incomeDate,
      },
      {
        note: FIXTURE_NOTES.groceries,
        type: 'expense' as const,
        amount: 1_200_000,
        categoryId: groceryCategory._id,
        date: expenseDate,
      },
      {
        note: FIXTURE_NOTES.pharmacy,
        type: 'expense' as const,
        amount: 800_000,
        categoryId: pharmacyCategory._id,
        date: expenseDate,
      },
    ];

    await Promise.all([
      ...transactions.map(({ note, ...transaction }) =>
        Transaction.findOneAndUpdate(
          { userId: senior._id, note },
          { $set: { ...transaction, note, deletedAt: null } },
          { new: true, upsert: true, runValidators: true },
        ),
      ),
      Budget.findOneAndUpdate(
        {
          userId: senior._id,
          categoryId: groceryCategory._id,
          monthKey,
        },
        { $set: { limitAmount: 5_000_000 } },
        { new: true, upsert: true, runValidators: true },
      ),
      Reminder.findOneAndUpdate(
        { userId: senior._id, title: 'یادآور قبض آزمایشی' },
        {
          $set: {
            date: new Date(month.today.getTime() + 7 * dayInMs),
            recurrence: 'monthly',
            amount: 900_000,
            isActive: true,
            deletedAt: null,
          },
        },
        { new: true, upsert: true, runValidators: true },
      ),
      CaregiverLink.findOneAndUpdate(
        { seniorId: senior._id, caregiverPhone: TEST_USERS[1].phone },
        {
          $set: {
            caregiverId: caregiver._id,
            status: 'active',
            permissions: { readSummary: true, readTransactions: true, readReports: true },
            respondedAt: new Date(),
            revokedAt: null,
          },
        },
        { new: true, upsert: true, runValidators: true },
      ),
    ]);

    console.log(JSON.stringify({
      database: '127.0.0.1:27017/asoudeh_dev',
      users: TEST_USERS.map(({ name, phone, role, email }) => ({ name, phone, role, email })),
      sampleData: {
        seniorCategories: 3,
        transactions: [
          { type: 'income', amount: 18_000_000 },
          { type: 'expense', amount: 1_200_000 },
          { type: 'expense', amount: 800_000 },
        ],
        monthlyBudget: { category: 'خرید روزانه آزمایشی', limitAmount: 5_000_000 },
        monthlyReminder: { title: 'یادآور قبض آزمایشی', amount: 900_000 },
        activeCaregiverLink: {
          senior: TEST_USERS[0].name,
          caregiver: TEST_USERS[1].name,
          permissions: ['summary', 'transactions', 'reports'],
        },
      },
      login: 'Passwordless OTP; use the local development simulator code.',
    }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

seedTestUsers().catch((error: unknown) => {
  console.error(
    'Test-user seeding failed.',
    error instanceof Error ? error.message : 'Unexpected seeding error.',
  );
  process.exitCode = 1;
});
