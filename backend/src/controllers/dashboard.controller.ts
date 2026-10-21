import type { RequestHandler } from 'express';
import { getDashboard } from '../services/dashboard.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';

export const getDashboardData: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'برای ادامه وارد حساب خود شوید.');
  }

  const dashboard = await getDashboard(req.user.userId);
  res.json({ success: true, data: dashboard });
});
