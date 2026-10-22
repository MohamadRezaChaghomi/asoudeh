import mongoose from 'mongoose';
import Budget from '../models/Budget.js';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import { HttpError } from '../utils/httpError.js';
import { decimalIntegerToBigInt } from '../utils/financialAmount.js';
import {
  formatUtcDateOnly,
  getJalaliMonthRange,
} from '../utils/jalaliMonth.js';
import type {
  CreateBudgetInput,
  UpdateBudgetInput,
} from '../validators/budget.validator.js';

const UNAVAILABLE_CATEGORY = 'دسته‌بندی بودجه باید یک دستهٔ هزینهٔ فعال و شخصی باشد.';

interface BudgetRecord {
  _id: { toString(): string };
  categoryId: {
    _id: { toString(): string };
    name: string;
    icon?: string;
    isActive: boolean;
    type: string;
  };
  monthKey: string;
  limitAmount: number;
}

interface ExpenseTotal {
  _id: mongoose.Types.ObjectId;
  amount: { toString(): string };
}

export interface BudgetResponse {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryIsActive: boolean;
  monthKey: string;
  limitAmount: number;
  spentAmount: string;
  remainingAmount: string;
  percentageUsed: number;
  status: 'normal' | 'warning' | 'exceeded';
}

export interface BudgetMonthResponse {
  monthKey: string;
  period: {
    startDate: string;
    endDateExclusive: string;
  };
  budgets: BudgetResponse[];
}

function parseMonthKey(monthKey: string): { year: number; month: number } {
  const [month, year] = monthKey.split('-').map(Number);
  return { year, month };
}

function toBudgetResponse(
  budget: BudgetRecord,
  spentAmount: bigint,
): BudgetResponse {
  if (!Number.isSafeInteger(budget.limitAmount) || budget.limitAmount < 1) {
    throw new HttpError(500, 'INVALID_BUDGET_DATA', 'مبلغ بودجهٔ ذخیره‌شده معتبر نیست.');
  }

  const limitAmount = BigInt(budget.limitAmount);
  const percentageTenths =
    (spentAmount * 1000n + limitAmount / 2n) / limitAmount;
  const percentageUsed = Number(percentageTenths) / 10;

  return {
    id: budget._id.toString(),
    categoryId: budget.categoryId._id.toString(),
    categoryName: budget.categoryId.name,
    categoryIcon: budget.categoryId.icon ?? 'wallet',
    categoryIsActive: budget.categoryId.isActive,
    monthKey: budget.monthKey,
    limitAmount: budget.limitAmount,
    spentAmount: spentAmount.toString(),
    remainingAmount: (limitAmount - spentAmount).toString(),
    percentageUsed,
    status:
      spentAmount >= limitAmount
        ? 'exceeded'
        : spentAmount * 100n >= limitAmount * 80n
          ? 'warning'
          : 'normal',
  };
}

async function requireEligibleCategory(
  userId: string,
  categoryId: string,
  allowInactive = false,
): Promise<void> {
  const category = await Category.findOne({
    _id: new mongoose.Types.ObjectId(categoryId),
    userId: new mongoose.Types.ObjectId(userId),
  })
    .select('type isActive')
    .lean();

  if (
    !category ||
    category.type !== 'expense' ||
    (!allowInactive && !category.isActive)
  ) {
    throw new HttpError(400, 'BUDGET_CATEGORY_UNAVAILABLE', UNAVAILABLE_CATEGORY);
  }
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}

async function requireBudget(
  userId: string,
  budgetId: string,
): Promise<BudgetRecord> {
  const budget = await Budget.findOne({
    _id: new mongoose.Types.ObjectId(budgetId),
    userId: new mongoose.Types.ObjectId(userId),
  })
    .populate<{ categoryId: BudgetRecord['categoryId'] }>({
      path: 'categoryId',
      select: 'name icon isActive type',
    })
    .lean();

  if (!budget) {
    throw new HttpError(404, 'BUDGET_NOT_FOUND', 'بودجه پیدا نشد.');
  }
  if (!budget.categoryId) {
    throw new HttpError(500, 'BUDGET_CATEGORY_MISSING', 'دسته‌بندی بودجه پیدا نشد.');
  }

  return budget as BudgetRecord;
}

export async function listBudgets(
  userId: string,
  monthKey: string,
): Promise<BudgetMonthResponse> {
  const { year, month } = parseMonthKey(monthKey);
  const range = getJalaliMonthRange(year, month);
  const ownerId = new mongoose.Types.ObjectId(userId);
  const budgets = await Budget.find({ userId: ownerId, monthKey })
    .populate<{ categoryId: BudgetRecord['categoryId'] }>({
      path: 'categoryId',
      select: 'name icon isActive type',
    })
    .lean();

  const categoryIds = budgets.map((budget) => budget.categoryId?._id);
  const totals = categoryIds.length
    ? await Transaction.aggregate<ExpenseTotal>([
        {
          $match: {
            userId: ownerId,
            type: 'expense',
            deletedAt: null,
            categoryId: { $in: categoryIds },
            date: { $gte: range.startDate, $lt: range.endDateExclusive },
          },
        },
        {
          $group: {
            _id: '$categoryId',
            amount: { $sum: { $toDecimal: '$amount' } },
          },
        },
      ])
    : [];
  const spentByCategory = new Map(
    totals.map((total) => [
      total._id.toString(),
      decimalIntegerToBigInt(total.amount.toString()),
    ]),
  );

  const budgetResponses = budgets
    .map((budget) => {
      if (!budget.categoryId) {
        throw new HttpError(500, 'BUDGET_CATEGORY_MISSING', 'دسته‌بندی بودجه پیدا نشد.');
      }
      const categoryId = budget.categoryId._id.toString();
      return toBudgetResponse(
        budget as BudgetRecord,
        spentByCategory.get(categoryId) ?? 0n,
      );
    })
    .sort((left, right) => left.categoryName.localeCompare(right.categoryName, 'fa'));

  return {
    monthKey,
    period: {
      startDate: formatUtcDateOnly(range.startDate),
      endDateExclusive: formatUtcDateOnly(range.endDateExclusive),
    },
    budgets: budgetResponses,
  };
}

async function budgetById(
  userId: string,
  budgetId: string,
  monthKey: string,
): Promise<BudgetResponse> {
  const month = await listBudgets(userId, monthKey);
  const budget = month.budgets.find(({ id }) => id === budgetId);
  if (!budget) {
    throw new HttpError(500, 'BUDGET_NOT_FOUND_AFTER_SAVE', 'بودجه پس از ذخیره‌سازی پیدا نشد.');
  }
  return budget;
}

export async function createBudget(
  userId: string,
  input: CreateBudgetInput,
): Promise<BudgetResponse> {
  await requireEligibleCategory(userId, input.categoryId);

  let budget: { _id: mongoose.Types.ObjectId };
  try {
    budget = await Budget.create({
      ...input,
      userId: new mongoose.Types.ObjectId(userId),
    });
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw new HttpError(
        409,
        'BUDGET_ALREADY_EXISTS',
        'برای این دسته‌بندی در این ماه بودجه ثبت شده است.',
      );
    }
    throw error;
  }

  return budgetById(userId, budget._id.toString(), input.monthKey);
}

export async function updateBudget(
  userId: string,
  budgetId: string,
  input: UpdateBudgetInput,
): Promise<BudgetResponse> {
  const existing = await requireBudget(userId, budgetId);
  const currentCategoryId = existing.categoryId._id.toString();
  const nextCategoryId = input.categoryId ?? currentCategoryId;
  await requireEligibleCategory(
    userId,
    nextCategoryId,
    nextCategoryId === currentCategoryId,
  );

  try {
    const updated = await Budget.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(budgetId),
        userId: new mongoose.Types.ObjectId(userId),
      },
      { $set: input },
      { new: true, runValidators: true },
    ).lean();

    if (!updated) {
      throw new HttpError(404, 'BUDGET_NOT_FOUND', 'بودجه پیدا نشد.');
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (isDuplicateKey(error)) {
      throw new HttpError(
        409,
        'BUDGET_ALREADY_EXISTS',
        'برای این دسته‌بندی در این ماه بودجه ثبت شده است.',
      );
    }
    throw error;
  }

  return budgetById(userId, budgetId, existing.monthKey);
}

export async function deleteBudget(userId: string, budgetId: string): Promise<void> {
  const deleted = await Budget.findOneAndDelete({
    _id: new mongoose.Types.ObjectId(budgetId),
    userId: new mongoose.Types.ObjectId(userId),
  });

  if (!deleted) {
    throw new HttpError(404, 'BUDGET_NOT_FOUND', 'بودجه پیدا نشد.');
  }
}
