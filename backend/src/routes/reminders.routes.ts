import { Router } from 'express';
import {
  completeReminderHandler,
  getReminders,
  patchReminder,
  postReminder,
  removeReminder,
} from '../controllers/reminders.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCsrf } from '../middleware/csrf.js';
import { requireOrigin } from '../middleware/requireOrigin.js';
import {
  validateBody,
  validateParams,
} from '../validators/validateBody.js';
import {
  completeReminderSchema,
  createReminderSchema,
  reminderParamsSchema,
  updateReminderSchema,
} from '../validators/reminder.validator.js';

const router = Router();

router.get('/', requireAuth, getReminders);
router.post(
  '/',
  requireOrigin,
  requireCsrf,
  requireAuth,
  validateBody(createReminderSchema),
  postReminder,
);
router.post(
  '/:id/complete',
  requireOrigin,
  requireCsrf,
  requireAuth,
  validateParams(reminderParamsSchema),
  validateBody(completeReminderSchema),
  completeReminderHandler,
);
router.patch(
  '/:id',
  requireOrigin,
  requireCsrf,
  requireAuth,
  validateParams(reminderParamsSchema),
  validateBody(updateReminderSchema),
  patchReminder,
);
router.delete(
  '/:id',
  requireOrigin,
  requireCsrf,
  requireAuth,
  validateParams(reminderParamsSchema),
  removeReminder,
);

export default router;
