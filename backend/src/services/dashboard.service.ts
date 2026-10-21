import mongoose from 'mongoose';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { getUpcomingReminders } from './reminders.service.js';
import { HttpError } from '../utils/httpError.js';
import { decimalIntegerToBigInt } from '../utils/financialAmount.js';
import {
  formatUtcDateOnly,
  getCurrentJalaliMonthRange,
} from '../utils/jalaliMonth.js';

type TransactionType = 'income' | 'expense';
interface MonthlyTotal {
  _id: TransactionType;
  amount: { toString(): string };
}

interface PopulatedTransaction {
  _id: mongoose.Types.ObjectId;
  type: TransactionType;
  amount: number;
  categoryId: {
    _id: mongoose.Types.ObjectId;
    name: string;
    icon?: string;
  };
  date: Date;
  note?: string | null;
}

export interface DashboardResponse {
  period: {
    calendar: 'jalali';
    year: number;
    month: number;
    startDate: string;
    endDateExclusive: string;
  };
  balance: {
    initialBalance: number;
    income: string;
    expenses: string;
    remaining: string;
  };
  recentTransactions: Array<{
    id: string;
    type: TransactionType;
    amount: number;
    categoryId: string;
    categoryName: string;
    categoryIcon: string;
    date: string;
    note: string;
  }>;
  upcomingReminders: Array<{
    id: string;
    title: string;
    date: string;
    recurrence: 'none' | 'monthly' | 'yearly';
    amount?: number;
  }>;
}

export async function getDashboard(
  userId: string,
  now = new Date(),
): Promise<DashboardResponse> {
  const ownerId = new mongoose.Types.ObjectId(userId);
  const { year, month, startDate, endDateExclusive } =
    getCurrentJalaliMonthRange(now);

  const [user, totals, recentTransactions, upcomingReminders] = await Promise.all([
    User.findById(ownerId).select('initialBalance').lean(),
    Transaction.aggregate<MonthlyTotal>([
      {
        $match: {
          userId: ownerId,
          deletedAt: null,
          date: { $gte: startDate, $lt: endDateExclusive },
        },
      },
      {
        $group: {
          _id: '$type',
          amount: { $sum: { $toDecimal: '$amount' } },
        },
      },
    ]),
    Transaction.find({ userId: ownerId, deletedAt: null })
      .select('type amount categoryId date note')
      .populate<{ categoryId: PopulatedTransaction['categoryId'] }>({
        path: 'categoryId',
        model: Category,
        select: 'name icon',
      })
      .sort({ date: -1, _id: -1 })
      .limit(5)
      .lean(),
    getUpcomingReminders(userId, now),
  ]);

  if (!user) {
    throw new HttpError(404, 'USER_NOT_FOUND', 'کاربر پیدا نشد.');
  }

  let income = 0n;
  let expenses = 0n;
  for (const total of totals) {
    if (total._id === 'income') income = decimalIntegerToBigInt(total.amount.toString());
    if (total._id === 'expense') expenses = decimalIntegerToBigInt(total.amount.toString());
  }

  const initialBalance = user.initialBalance ?? 0;
  if (!Number.isSafeInteger(initialBalance) || initialBalance < 0) {
    throw new HttpError(
      500,
      'INVALID_FINANCIAL_DATA',
      'موجودی اولیهٔ حساب معتبر نیست.',
    );
  }
  const initialBalanceInteger = BigInt(initialBalance);

  return {
    period: {
      calendar: 'jalali',
      year,
      month,
      startDate: formatUtcDateOnly(startDate),
      endDateExclusive: formatUtcDateOnly(endDateExclusive),
    },
    balance: {
      initialBalance,
      income: income.toString(),
      expenses: expenses.toString(),
      remaining: (initialBalanceInteger + income - expenses).toString(),
    },
    recentTransactions: recentTransactions.map((transaction) => ({
      id: transaction._id.toString(),
      type: transaction.type,
      amount: transaction.amount,
      categoryId: transaction.categoryId._id.toString(),
      categoryName: transaction.categoryId.name,
      categoryIcon: transaction.categoryId.icon ?? 'wallet',
      date: formatUtcDateOnly(transaction.date),
      note: transaction.note ?? '',
    })),
    upcomingReminders,
  };
}
