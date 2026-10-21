import { Router } from 'express';
import {
  deleteCategory,
  getCategories,
  patchCategory,
  postCategory,
} from '../controllers/categories.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCsrf } from '../middleware/csrf.js';
import { requireOrigin } from '../middleware/requireOrigin.js';
import { validateBody, validateParams } from '../validators/validateBody.js';
import {
  categoryParamsSchema,
  createCategorySchema,
  updateCategorySchema,
} from '../validators/category.validator.js';

const router = Router();

router.get('/', requireAuth, getCategories);
router.post(
  '/',
  requireOrigin,
  requireCsrf,
  requireAuth,
  validateBody(createCategorySchema),
  postCategory,
);
router.patch(
  '/:id',
  requireOrigin,
  requireCsrf,
  requireAuth,
  validateParams(categoryParamsSchema),
  validateBody(updateCategorySchema),
  patchCategory,
);
router.delete(
  '/:id',
  requireOrigin,
  requireCsrf,
  requireAuth,
  validateParams(categoryParamsSchema),
  deleteCategory,
);

export default router;
