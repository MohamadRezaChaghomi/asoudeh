import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import AuthSession from '../models/AuthSession.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getCookie } from './csrf.js';
import { HttpError } from '../utils/httpError.js';

export const requireAuth: RequestHandler = asyncHandler(async (req, _res, next) => {
  const token = getCookie(req, 'asoudeh_access');

  if (!token) {
    next(new HttpError(401, 'AUTHENTICATION_REQUIRED', 'برای ادامه وارد حساب خود شوید.'));
    return;
  }

  let userId: string;
  let sessionId: string;
  try {
    const verified = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });

    if (
      typeof verified === 'string' ||
      verified.purpose !== 'access' ||
      typeof verified.sub !== 'string' ||
      typeof verified.sid !== 'string'
    ) {
      throw new Error('Invalid access token claims');
    }

    userId = verified.sub;
    sessionId = verified.sid;
  } catch {
    next(new HttpError(401, 'AUTHENTICATION_REQUIRED', 'نشست معتبر نیست. دوباره وارد شوید.'));
    return;
  }

  const activeSession = await AuthSession.exists({
    _id: sessionId,
    userId,
    rotatedAt: null,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!activeSession) {
    next(new HttpError(401, 'AUTHENTICATION_REQUIRED', 'نشست معتبر نیست. دوباره وارد شوید.'));
    return;
  }

  req.user = { userId, sessionId };
  next();
});
