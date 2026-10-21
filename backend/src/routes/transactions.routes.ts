import { Router } from 'express';
import {
  getTransactions,
  patchTransaction,
  postTransaction,
  postRestoreTransaction,
  removeTransaction,
} from '../controllers/transactions.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCsrf } from '../middleware/csrf.js';
import { requireOrigin } from '../middleware/requireOrigin.js';
import { validateBody, validateParams, validateQuery } from '../validators/validateBody.js';
import {
  createTransactionSchema,
  transactionParamsSchema,
  transactionQuerySchema,
  updateTransactionSchema,
} from '../validators/transaction.validator.js';

const router = Router();

router.get('/', requireAuth, validateQuery(transactionQuerySchema), getTransactions);
router.post(
  '/',
  requireOrigin,
  requireCsrf,
  requireAuth,
  validateBody(createTransactionSchema),
  postTransaction,
);
router.post(
  '/:id/restore',
  requireOrigin,
  requireCsrf,
  requireAuth,
  validateParams(transactionParamsSchema),
  postRestoreTransaction,
);
router.patch(
  '/:id',
  requireOrigin,
  requireCsrf,
  requireAuth,
  validateParams(transactionParamsSchema),
  validateBody(updateTransactionSchema),
  patchTransaction,
);
router.delete(
  '/:id',
  requireOrigin,
  requireCsrf,
  requireAuth,
  validateParams(transactionParamsSchema),
  removeTransaction,
);

export default router;
