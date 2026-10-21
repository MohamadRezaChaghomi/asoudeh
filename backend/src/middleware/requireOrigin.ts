import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

export const requireOrigin: RequestHandler = (req, _res, next) => {
  const origin = req.get('Origin');
  let expectedOrigin: string;

  try {
    expectedOrigin = new URL(env.clientUrl).origin;
  } catch {
    next(new HttpError(503, 'AUTH_NOT_CONFIGURED', 'سرویس احراز هویت پیکربندی نشده است.'));
    return;
  }

  if (!origin || origin === 'null') {
    next(new HttpError(403, 'ORIGIN_REQUIRED', 'درخواست از مبدأ مجاز ارسال نشده است.'));
    return;
  }

  try {
    if (new URL(origin).origin !== expectedOrigin) {
      next(new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'مبدأ درخواست مجاز نیست.'));
      return;
    }
  } catch {
    next(new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'مبدأ درخواست معتبر نیست.'));
    return;
  }

  next();
};
