import type { Request, RequestHandler } from 'express';
import {
  getCaregiverReport,
  getCaregiverSummary,
  getCaregiverTransactions,
  inviteCaregiver,
  listAccessibleSeniors,
  listCaregiverLinks,
  listIncomingInvitations,
  respondToInvitation,
  revokeCaregiverLink,
} from '../services/caregiver.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import type { TransactionQuery } from '../validators/transaction.validator.js';
import type {
  CaregiverDecisionInput,
  InviteCaregiverInput,
} from '../validators/caregiver.validator.js';
import type { ReportQuery } from '../validators/report.validator.js';

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'برای ادامه وارد حساب خود شوید.');
  }
  return req.user.userId;
}

export const getCaregiverLinks: RequestHandler = asyncHandler(async (req, res) => {
  const links = await listCaregiverLinks(requireUserId(req));
  res.json({ success: true, data: { links } });
});

export const postCaregiverInvitation: RequestHandler = asyncHandler(async (req, res) => {
  const link = await inviteCaregiver(
    requireUserId(req),
    req.body as InviteCaregiverInput,
  );
  res.status(201).json({ success: true, data: { invitation: link } });
});

export const deleteCaregiverLink: RequestHandler = asyncHandler(async (req, res) => {
  const link = await revokeCaregiverLink(requireUserId(req), req.params.id);
  res.json({ success: true, data: { link }, message: 'دسترسی مراقب لغو شد.' });
});

export const getIncomingInvitations: RequestHandler = asyncHandler(async (req, res) => {
  const invitations = await listIncomingInvitations(requireUserId(req));
  res.json({ success: true, data: { invitations } });
});

export const patchCaregiverInvitation: RequestHandler = asyncHandler(async (req, res) => {
  const invitation = await respondToInvitation(
    requireUserId(req),
    req.params.id,
    req.body as CaregiverDecisionInput,
  );
  res.json({ success: true, data: { invitation } });
});

export const getAccessibleSeniors: RequestHandler = asyncHandler(async (req, res) => {
  const seniors = await listAccessibleSeniors(requireUserId(req));
  res.json({ success: true, data: { seniors } });
});

export const getCaregiverSeniorSummary: RequestHandler = asyncHandler(async (req, res) => {
  const summary = await getCaregiverSummary(requireUserId(req), req.params.seniorId);
  res.json({ success: true, data: { summary } });
});

export const getCaregiverSeniorTransactions: RequestHandler = asyncHandler(async (req, res) => {
  const transactions = await getCaregiverTransactions(
    requireUserId(req),
    req.params.seniorId,
    res.locals.validatedQuery as TransactionQuery,
  );
  res.json({ success: true, data: transactions });
});

export const getCaregiverSeniorReport: RequestHandler = asyncHandler(async (req, res) => {
  const { month } = res.locals.validatedQuery as ReportQuery;
  const report = await getCaregiverReport(requireUserId(req), req.params.seniorId, month);
  res.json({ success: true, data: { report } });
});
