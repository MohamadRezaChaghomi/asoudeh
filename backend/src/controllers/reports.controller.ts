import type { Request, RequestHandler } from 'express';
import { getMonthlyReport } from '../services/reports.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import type { ReportQuery } from '../validators/report.validator.js';

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'برای ادامه وارد حساب خود شوید.');
  }
  return req.user.userId;
}

export const getReport: RequestHandler = asyncHandler(async (req, res) => {
  const { month } = res.locals.validatedQuery as ReportQuery;
  const report = await getMonthlyReport(requireUserId(req), month);
  res.json({ success: true, data: { report } });
});
