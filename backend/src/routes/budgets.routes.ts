import { Router } from 'express';
import {
  getBudgets,
  patchBudget,
  postBudget,
  removeBudget,
} from '../controllers/budgets.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCsrf } from '../middleware/csrf.js';
import { requireOrigin } from '../middleware/requireOrigin.js';
import { validateBody, validateParams, validateQuery } from '../validators/validateBody.js';
import {
  budgetParamsSchema,
  budgetQuerySchema,
  createBudgetSchema,
  updateBudgetSchema,
} from '../validators/budget.validator.js';

const router = Router();

router.get('/', requireAuth, validateQuery(budgetQuerySchema), getBudgets);
router.post(
  '/',
  requireOrigin,
  requireCsrf,
  requireAuth,
  validateBody(createBudgetSchema),
  postBudget,
);
router.patch(
  '/:id',
  requireOrigin,
  requireCsrf,
  requireAuth,
  validateParams(budgetParamsSchema),
  validateBody(updateBudgetSchema),
  patchBudget,
);
router.delete(
  '/:id',
  requireOrigin,
  requireCsrf,
  requireAuth,
  validateParams(budgetParamsSchema),
  removeBudget,
);

export default router;
