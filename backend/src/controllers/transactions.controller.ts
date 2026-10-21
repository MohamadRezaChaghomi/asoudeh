import type { Request, RequestHandler } from 'express';
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  restoreTransaction,
  updateTransaction,
} from '../services/transactions.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import type {
  CreateTransactionInput,
  TransactionQuery,
  UpdateTransactionInput,
} from '../validators/transaction.validator.js';

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'برای ادامه وارد حساب خود شوید.');
  }

  return req.user.userId;
}

export const getTransactions: RequestHandler = asyncHandler(async (req, res) => {
  const result = await listTransactions(
    requireUserId(req),
    res.locals.validatedQuery as TransactionQuery,
  );
  res.json({ success: true, data: result });
});

export const postTransaction: RequestHandler = asyncHandler(async (req, res) => {
  const transaction = await createTransaction(
    requireUserId(req),
    req.body as CreateTransactionInput,
  );
  res.status(201).json({ success: true, data: { transaction } });
});

export const patchTransaction: RequestHandler = asyncHandler(async (req, res) => {
  const transaction = await updateTransaction(
    requireUserId(req),
    req.params.id,
    req.body as UpdateTransactionInput,
  );
  res.json({ success: true, data: { transaction } });
});

export const removeTransaction: RequestHandler = asyncHandler(async (req, res) => {
  const deletion = await deleteTransaction(requireUserId(req), req.params.id);
  res.json({ success: true, data: deletion, message: 'تراکنش حذف شد.' });
});

export const postRestoreTransaction: RequestHandler = asyncHandler(async (req, res) => {
  const transaction = await restoreTransaction(requireUserId(req), req.params.id);
  res.json({ success: true, data: { transaction } });
});
