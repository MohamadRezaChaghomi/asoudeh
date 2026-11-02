import { Router } from 'express';
import { getStatus, sendMessage } from '../controllers/assistant.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCsrf } from '../middleware/csrf.js';
import { requireOrigin } from '../middleware/requireOrigin.js';
import { validateBody } from '../validators/validateBody.js';
import { assistantMessageSchema } from '../validators/assistant.validator.js';

const router = Router();

router.get('/status', requireAuth, getStatus);
router.post(
  '/messages',
  requireOrigin,
  requireAuth,
  requireCsrf,
  validateBody(assistantMessageSchema),
  sendMessage,
);

export default router;
