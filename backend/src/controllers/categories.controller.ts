import type { Request, RequestHandler } from 'express';
import {
  createCategory,
  listCategories,
  rejectCategoryDeletion,
  updateCategory,
} from '../services/categories.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../validators/category.validator.js';

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'برای ادامه وارد حساب خود شوید.');
  }

  return req.user.userId;
}

export const getCategories: RequestHandler = asyncHandler(async (req, res) => {
  const categories = await listCategories(requireUserId(req));
  res.json({ success: true, data: { categories } });
});

export const postCategory: RequestHandler = asyncHandler(async (req, res) => {
  const category = await createCategory(
    requireUserId(req),
    req.body as CreateCategoryInput,
  );
  res.status(201).json({ success: true, data: { category } });
});

export const patchCategory: RequestHandler = asyncHandler(async (req, res) => {
  const category = await updateCategory(
    requireUserId(req),
    req.params.id,
    req.body as UpdateCategoryInput,
  );
  res.json({ success: true, data: { category } });
});

export const deleteCategory: RequestHandler = asyncHandler(async (req, _res) => {
  await rejectCategoryDeletion(requireUserId(req), req.params.id);
});
