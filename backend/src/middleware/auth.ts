import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import AuthSession from '../models/AuthSession.js';
import User from '../models/User.js';
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

  const activeSession = await AuthSession.findOne({
    _id: sessionId,
    userId,
    rotatedAt: null,
    revokedAt: null,
  }).select('familyId idleExpiresAt expiresAt');

  if (!activeSession) {
    next(new HttpError(401, 'AUTHENTICATION_REQUIRED', 'نشست معتبر نیست. دوباره وارد شوید.'));
    return;
  }

  const now = new Date();
  if (
    activeSession.expiresAt <= now ||
    !activeSession.idleExpiresAt ||
    activeSession.idleExpiresAt <= now
  ) {
    await AuthSession.updateMany(
      { familyId: activeSession.familyId, revokedAt: null },
      { $set: { revokedAt: now } },
    );
    next(new HttpError(401, 'SESSION_EXPIRED', 'نشست منقضی شده است. دوباره وارد شوید.'));
    return;
  }

  const activeUser = await User.exists({
    _id: userId,
    deletionScheduledAt: null,
  });
  if (!activeUser) {
    next(new HttpError(401, 'SESSION_INVALID', 'این حساب دیگر فعال نیست.'));
    return;
  }

  req.user = { userId, sessionId };
  next();
});
