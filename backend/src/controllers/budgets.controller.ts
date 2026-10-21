import type { Request, RequestHandler } from 'express';
import {
  createBudget,
  deleteBudget,
  listBudgets,
  updateBudget,
} from '../services/budgets.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import type {
  BudgetQuery,
  CreateBudgetInput,
  UpdateBudgetInput,
} from '../validators/budget.validator.js';

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'برای ادامه وارد حساب خود شوید.');
  }

  return req.user.userId;
}

export const getBudgets: RequestHandler = asyncHandler(async (req, res) => {
  const { month } = res.locals.validatedQuery as BudgetQuery;
  const result = await listBudgets(requireUserId(req), month);
  res.json({ success: true, data: result });
});

export const postBudget: RequestHandler = asyncHandler(async (req, res) => {
  const budget = await createBudget(
    requireUserId(req),
    req.body as CreateBudgetInput,
  );
  res.status(201).json({ success: true, data: { budget } });
});

export const patchBudget: RequestHandler = asyncHandler(async (req, res) => {
  const budget = await updateBudget(
    requireUserId(req),
    req.params.id,
    req.body as UpdateBudgetInput,
  );
  res.json({ success: true, data: { budget } });
});

export const removeBudget: RequestHandler = asyncHandler(async (req, res) => {
  await deleteBudget(requireUserId(req), req.params.id);
  res.json({ success: true, message: 'بودجه حذف شد.' });
});
