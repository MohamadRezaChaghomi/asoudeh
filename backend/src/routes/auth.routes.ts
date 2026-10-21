import { Router } from 'express';
import {
  csrfBootstrap,
  getCurrentProfile,
  logout,
  patchCurrentProfile,
  refresh,
  register,
  requestOtp,
  scheduleAccountDeletion,
  verifyOtp,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOrigin } from '../middleware/requireOrigin.js';
import { validateBody } from '../validators/validateBody.js';
import {
  completeRegistrationSchema,
  requestOtpSchema,
  accountDeletionSchema,
  updateProfileSchema,
  verifyOtpSchema,
} from '../validators/auth.validator.js';

const router = Router();
export const profileRouter = Router();

router.post('/otp/request', requireOrigin, validateBody(requestOtpSchema), requestOtp);
router.post('/otp/verify', requireOrigin, validateBody(verifyOtpSchema), verifyOtp);
router.post(
  '/register/complete',
  requireOrigin,
  validateBody(completeRegistrationSchema),
  register,
);
router.post('/refresh', requireOrigin, refresh);
router.post('/logout', requireOrigin, logout);
router.post(
  '/account-deletion',
  requireOrigin,
  validateBody(accountDeletionSchema),
  scheduleAccountDeletion,
);
router.get('/csrf', csrfBootstrap);
profileRouter.get('/me', requireAuth, getCurrentProfile);
profileRouter.patch(
  '/me/profile',
  requireOrigin,
  validateBody(updateProfileSchema),
  patchCurrentProfile,
);

export default router;
