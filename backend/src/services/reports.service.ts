import mongoose from 'mongoose';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import { decimalIntegerToBigInt } from '../utils/financialAmount.js';
import {
  formatJalaliMonthKey,
  formatUtcDateOnly,
  getJalaliMonthRange,
} from '../utils/jalaliMonth.js';

interface AggregatedAmount {
  _id: string | mongoose.Types.ObjectId;
  amount: { toString(): string };
  count?: number;
}

interface ReportCategory {
  _id: mongoose.Types.ObjectId;
  name: string;
  icon?: string;
}

export interface MonthlyReportResponse {
  monthKey: string;
  period: {
    startDate: string;
    endDateExclusive: string;
  };
  totals: {
    income: string;
    expenses: string;
    transactionCount: number;
  };
  comparison: {
    previousMonthKey: string;
    previousExpenses: string;
    expenseChange: string;
    expenseChangePercentage: number | null;
  };
  expensesByCategory: Array<{
    categoryId: string;
    categoryName: string;
    categoryIcon: string;
    amount: string;
    sharePercentage: number;
  }>;
}

function previousMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function amountForType(totals: AggregatedAmount[], type: 'income' | 'expense'): bigint {
  const total = totals.find(({ _id }) => _id === type);
  return total ? decimalIntegerToBigInt(total.amount.toString()) : 0n;
}

function percentageChange(current: bigint, previous: bigint): number | null {
  if (previous === 0n) return null;
  const tenths = ((current - previous) * 1000n) / previous;
  return Number(tenths) / 10;
}

export async function getMonthlyReport(
  userId: string,
  monthKey: string,
): Promise<MonthlyReportResponse> {
  const [monthText, yearText] = monthKey.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const currentRange = getJalaliMonthRange(year, month);
  const previousParts = previousMonth(year, month);
  const previousMonthKey = formatJalaliMonthKey(previousParts.year, previousParts.month);
  const previousRange = getJalaliMonthRange(previousParts.year, previousParts.month);
  const ownerId = new mongoose.Types.ObjectId(userId);

  const [currentTotals, previousExpenseTotals, expenseGroups] = await Promise.all([
    Transaction.aggregate<AggregatedAmount>([
      {
        $match: {
          userId: ownerId,
          deletedAt: null,
          date: {
            $gte: currentRange.startDate,
            $lt: currentRange.endDateExclusive,
          },
        },
      },
      {
        $group: {
          _id: '$type',
          amount: { $sum: { $toDecimal: '$amount' } },
          count: { $sum: 1 },
        },
      },
    ]),
    Transaction.aggregate<AggregatedAmount>([
      {
        $match: {
          userId: ownerId,
          type: 'expense',
          deletedAt: null,
          date: {
            $gte: previousRange.startDate,
            $lt: previousRange.endDateExclusive,
          },
        },
      },
      {
        $group: {
          _id: 'expense',
          amount: { $sum: { $toDecimal: '$amount' } },
        },
      },
    ]),
    Transaction.aggregate<AggregatedAmount>([
      {
        $match: {
          userId: ownerId,
          type: 'expense',
          deletedAt: null,
          date: {
            $gte: currentRange.startDate,
            $lt: currentRange.endDateExclusive,
          },
        },
      },
      {
        $group: {
          _id: '$categoryId',
          amount: { $sum: { $toDecimal: '$amount' } },
        },
      },
    ]),
  ]);

  const income = amountForType(currentTotals, 'income');
  const expenses = amountForType(currentTotals, 'expense');
  const previousExpenses = previousExpenseTotals.length
    ? decimalIntegerToBigInt(previousExpenseTotals[0].amount.toString())
    : 0n;
  const categoryIds = expenseGroups.map(
    ({ _id }) => new mongoose.Types.ObjectId(_id.toString()),
  );
  const categories = categoryIds.length
    ? await Category.find({
        _id: { $in: categoryIds },
        $or: [{ userId: ownerId }, { userId: null }],
      })
        .select('name icon')
        .lean<ReportCategory[]>()
    : [];
  const categoryById = new Map(
    categories.map((category) => [category._id.toString(), category]),
  );

  const expensesByCategory = expenseGroups
    .map((group) => {
      const categoryId = group._id.toString();
      const category = categoryById.get(categoryId);
      if (!category) return undefined;
      const amount = decimalIntegerToBigInt(group.amount.toString());
      const shareTenths =
        expenses === 0n ? 0n : (amount * 1000n + expenses / 2n) / expenses;
      return {
        categoryId,
        categoryName: category?.name ?? 'دسته‌بندی ناموجود',
        categoryIcon: category?.icon ?? 'wallet',
        amount: amount.toString(),
        sharePercentage: Number(shareTenths) / 10,
      };
    })
    .filter((category): category is NonNullable<typeof category> => category !== undefined);
  const unavailableAmount = expenseGroups.reduce((sum, group) => {
    return categoryById.has(group._id.toString())
      ? sum
      : sum + decimalIntegerToBigInt(group.amount.toString());
  }, 0n);
  if (unavailableAmount > 0n) {
    const shareTenths =
      expenses === 0n ? 0n : (unavailableAmount * 1000n + expenses / 2n) / expenses;
    expensesByCategory.push({
      categoryId: 'unavailable',
      categoryName: 'دسته‌بندی ناموجود',
      categoryIcon: 'wallet',
      amount: unavailableAmount.toString(),
      sharePercentage: Number(shareTenths) / 10,
    });
  }
  expensesByCategory.sort((left, right) => {
    const leftAmount = BigInt(left.amount);
    const rightAmount = BigInt(right.amount);
    return leftAmount === rightAmount
      ? left.categoryName.localeCompare(right.categoryName, 'fa')
      : leftAmount > rightAmount
        ? -1
        : 1;
  });
  return {
    monthKey,
    period: {
      startDate: formatUtcDateOnly(currentRange.startDate),
      endDateExclusive: formatUtcDateOnly(currentRange.endDateExclusive),
    },
    totals: {
      income: income.toString(),
      expenses: expenses.toString(),
      transactionCount: currentTotals.reduce(
        (sum, total) => sum + (total.count ?? 0),
        0,
      ),
    },
    comparison: {
      previousMonthKey,
      previousExpenses: previousExpenses.toString(),
      expenseChange: (expenses - previousExpenses).toString(),
      expenseChangePercentage: percentageChange(expenses, previousExpenses),
    },
    expensesByCategory,
  };
}
