import { Router } from 'express';
import {
  deleteCaregiverLink,
  getAccessibleSeniors,
  getCaregiverLinks,
  getCaregiverSeniorReport,
  getCaregiverSeniorSummary,
  getCaregiverSeniorTransactions,
  getIncomingInvitations,
  patchCaregiverInvitation,
  postCaregiverInvitation,
} from '../controllers/caregiver.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCsrf } from '../middleware/csrf.js';
import { requireOrigin } from '../middleware/requireOrigin.js';
import { validateBody, validateParams, validateQuery } from '../validators/validateBody.js';
import {
  caregiverDecisionSchema,
  caregiverLinkParamsSchema,
  caregiverReportQuerySchema,
  caregiverSeniorParamsSchema,
  caregiverTransactionQuerySchema,
  inviteCaregiverSchema,
} from '../validators/caregiver.validator.js';

const router = Router();

router.get('/links', requireAuth, getCaregiverLinks);
router.post(
  '/links',
  requireOrigin,
  requireCsrf,
  requireAuth,
  validateBody(inviteCaregiverSchema),
  postCaregiverInvitation,
);
router.delete(
  '/links/:id',
  requireOrigin,
  requireCsrf,
  requireAuth,
  validateParams(caregiverLinkParamsSchema),
  deleteCaregiverLink,
);
router.get('/invitations', requireAuth, getIncomingInvitations);
router.patch(
  '/invitations/:id',
  requireOrigin,
  requireCsrf,
  requireAuth,
  validateParams(caregiverLinkParamsSchema),
  validateBody(caregiverDecisionSchema),
  patchCaregiverInvitation,
);
router.get('/seniors', requireAuth, getAccessibleSeniors);
router.get(
  '/seniors/:seniorId/summary',
  requireAuth,
  validateParams(caregiverSeniorParamsSchema),
  getCaregiverSeniorSummary,
);
router.get(
  '/seniors/:seniorId/transactions',
  requireAuth,
  validateParams(caregiverSeniorParamsSchema),
  validateQuery(caregiverTransactionQuerySchema),
  getCaregiverSeniorTransactions,
);
router.get(
  '/seniors/:seniorId/reports/monthly',
  requireAuth,
  validateParams(caregiverSeniorParamsSchema),
  validateQuery(caregiverReportQuerySchema),
  getCaregiverSeniorReport,
);

export default router;
