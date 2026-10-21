import mongoose from 'mongoose';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import { HttpError } from '../utils/httpError.js';
import type {
  CreateTransactionInput,
  TransactionQuery,
  UpdateTransactionInput,
} from '../validators/transaction.validator.js';

type TransactionType = 'income' | 'expense';
const TRANSACTION_UNDO_WINDOW_MS = 10_000;

interface TransactionRecord {
  _id: { toString(): string };
  type: TransactionType;
  amount: number;
  categoryId: {
    _id: { toString(): string };
    name: string;
    icon?: string;
  };
  date: Date;
  note?: string | null;
}

export interface TransactionResponse {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  date: string;
  note: string;
}

export interface TransactionPage {
  transactions: TransactionResponse[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface TransactionDeletion {
  deletedAt: string;
  undoExpiresAt: string;
}

function toTransactionResponse(transaction: TransactionRecord): TransactionResponse {
  return {
    id: transaction._id.toString(),
    type: transaction.type,
    amount: transaction.amount,
    categoryId: transaction.categoryId._id.toString(),
    categoryName: transaction.categoryId.name,
    categoryIcon: transaction.categoryId.icon ?? 'wallet',
    date: transaction.date.toISOString().slice(0, 10),
    note: transaction.note ?? '',
  };
}

async function requireAvailableCategory(
  userId: string,
  categoryId: string,
  transactionType: TransactionType,
  allowInactive = false,
): Promise<void> {
  const category = await Category.findOne({
    _id: new mongoose.Types.ObjectId(categoryId),
    ...(allowInactive ? {} : { isActive: true }),
    $or: [
      { userId: new mongoose.Types.ObjectId(userId) },
      { userId: null },
    ],
  })
    .select('type')
    .lean();

  if (!category) {
    throw new HttpError(400, 'CATEGORY_UNAVAILABLE', 'دسته‌بندی انتخاب‌شده در دسترس نیست.');
  }

  if (category.type !== transactionType && category.type !== 'both') {
    throw new HttpError(
      400,
      'CATEGORY_TYPE_MISMATCH',
      'نوع دسته‌بندی با نوع تراکنش سازگار نیست.',
    );
  }
}

function transactionFilter(userId: string, transactionId: string) {
  return {
    _id: new mongoose.Types.ObjectId(transactionId),
    userId: new mongoose.Types.ObjectId(userId),
    deletedAt: null,
  };
}

export async function listTransactions(
  userId: string,
  filters: TransactionQuery,
): Promise<TransactionPage> {
  const filter: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(userId),
    deletedAt: null,
  };
  if (filters.type) filter.type = filters.type;
  if (filters.categoryId) {
    filter.categoryId = new mongoose.Types.ObjectId(filters.categoryId);
  }
  if (filters.from || filters.to) {
    filter.date = {
      ...(filters.from ? { $gte: filters.from } : {}),
      ...(filters.to ? { $lte: new Date(filters.to.getTime() + 86_399_999) } : {}),
    };
  }

  const [transactions, totalItems] = await Promise.all([
    Transaction.find(filter)
      .populate<{ categoryId: TransactionRecord['categoryId'] }>({
        path: 'categoryId',
        select: 'name icon',
      })
      .sort({ date: -1, _id: -1 })
      .skip((filters.page - 1) * filters.pageSize)
      .limit(filters.pageSize)
      .lean(),
    Transaction.countDocuments(filter),
  ]);

  return {
    transactions: transactions.map((transaction) => toTransactionResponse(transaction)),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / filters.pageSize),
    },
  };
}

export async function createTransaction(
  userId: string,
  input: CreateTransactionInput,
): Promise<TransactionResponse> {
  await requireAvailableCategory(userId, input.categoryId, input.type);

  const transaction = await Transaction.create({
    ...input,
    userId: new mongoose.Types.ObjectId(userId),
  });
  const populated = await Transaction.findById(transaction._id)
    .populate<{ categoryId: TransactionRecord['categoryId'] }>({
      path: 'categoryId',
      select: 'name icon',
    })
    .lean();

  if (!populated) {
    throw new HttpError(500, 'INTERNAL_ERROR', 'تراکنش ذخیره شد اما بارگذاری آن ممکن نشد.');
  }

  return toTransactionResponse(populated);
}

export async function updateTransaction(
  userId: string,
  transactionId: string,
  input: UpdateTransactionInput,
): Promise<TransactionResponse> {
  const existing = await Transaction.findOne(transactionFilter(userId, transactionId)).lean();
  if (!existing) {
    throw new HttpError(404, 'TRANSACTION_NOT_FOUND', 'تراکنش پیدا نشد.');
  }

  const nextType = input.type ?? existing.type;
  const nextCategoryId = input.categoryId ?? existing.categoryId.toString();
  const categoryIsUnchanged =
    nextCategoryId === existing.categoryId.toString() && nextType === existing.type;
  await requireAvailableCategory(userId, nextCategoryId, nextType, categoryIsUnchanged);

  const transaction = await Transaction.findOneAndUpdate(
      transactionFilter(userId, transactionId),
      { $set: input },
      { new: true, runValidators: true },
    )
    .populate<{ categoryId: TransactionRecord['categoryId'] }>({
      path: 'categoryId',
      select: 'name icon',
    })
    .lean();

  if (!transaction) {
    throw new HttpError(404, 'TRANSACTION_NOT_FOUND', 'تراکنش پیدا نشد.');
  }

  return toTransactionResponse(transaction);
}

export async function deleteTransaction(
  userId: string,
  transactionId: string,
): Promise<TransactionDeletion> {
  const deletedAt = new Date();
  const transaction = await Transaction.findOneAndUpdate(
    transactionFilter(userId, transactionId),
    { $set: { deletedAt } },
  );

  if (!transaction) {
    throw new HttpError(404, 'TRANSACTION_NOT_FOUND', 'تراکنش پیدا نشد.');
  }

  return {
    deletedAt: deletedAt.toISOString(),
    undoExpiresAt: new Date(deletedAt.getTime() + TRANSACTION_UNDO_WINDOW_MS).toISOString(),
  };
}

export async function restoreTransaction(
  userId: string,
  transactionId: string,
): Promise<TransactionResponse> {
  const ownerFilter = {
    _id: new mongoose.Types.ObjectId(transactionId),
    userId: new mongoose.Types.ObjectId(userId),
  };
  const cutoff = new Date(Date.now() - TRANSACTION_UNDO_WINDOW_MS);
  const transaction = await Transaction.findOneAndUpdate(
    { ...ownerFilter, deletedAt: { $ne: null, $gt: cutoff } },
    { $set: { deletedAt: null } },
    { new: true },
  )
    .populate<{ categoryId: TransactionRecord['categoryId'] }>({
      path: 'categoryId',
      select: 'name icon',
    })
    .lean();

  if (transaction) {
    return toTransactionResponse(transaction);
  }

  const ownedDeletedTransaction = await Transaction.exists({
    ...ownerFilter,
    deletedAt: { $ne: null },
  });
  if (ownedDeletedTransaction) {
    throw new HttpError(410, 'TRANSACTION_UNDO_EXPIRED', 'مهلت بازگردانی تراکنش به پایان رسیده است.');
  }

  throw new HttpError(404, 'TRANSACTION_NOT_FOUND', 'تراکنش پیدا نشد.');
}
