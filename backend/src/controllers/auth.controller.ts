import { randomBytes } from 'node:crypto';
import type { Request, RequestHandler, Response } from 'express';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { getCookie, requireCsrf } from '../middleware/csrf.js';
import { requireOrigin } from '../middleware/requireOrigin.js';
import {
  completeRegistration,
  getProfile,
  recordSessionActivity,
  requestOtp as requestOtpService,
  revokeRefreshSession,
  rotateRefreshToken,
  scheduleAccountDeletion as scheduleAccountDeletionService,
  updateProfile,
  verifyOtp as verifyOtpService,
} from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import type {
  CompleteRegistrationInput,
  AccountDeletionInput,
  RequestOtpInput,
  UpdateProfileInput,
  VerifyOtpInput,
} from '../validators/auth.validator.js';

const ACCESS_COOKIE = 'asoudeh_access';
const REFRESH_COOKIE = 'asoudeh_refresh';
const CSRF_COOKIE = 'asoudeh_csrf';
const REGISTRATION_COOKIE = 'asoudeh_registration';
const ACCESS_PATH = '/api/v1';
const REFRESH_PATH = '/api/v1/auth';
const REGISTRATION_PATH = '/api/v1/auth/register';
const ACCESS_MAX_AGE = 15 * 60 * 1000;
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

function cookieOptions(path: string, httpOnly: boolean, maxAge: number) {
  return {
    httpOnly,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax' as const,
    path,
    maxAge,
  };
}

function setCsrfCookie(res: Response, token: string): void {
  res.cookie(CSRF_COOKIE, token, cookieOptions(ACCESS_PATH, false, REFRESH_MAX_AGE));
}

function setSessionCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string; csrfToken: string },
): void {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, cookieOptions(ACCESS_PATH, true, ACCESS_MAX_AGE));
  res.cookie(
    REFRESH_COOKIE,
    tokens.refreshToken,
    cookieOptions(REFRESH_PATH, true, REFRESH_MAX_AGE),
  );
  setCsrfCookie(res, tokens.csrfToken);
}

function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, cookieOptions(ACCESS_PATH, true, 0));
  res.clearCookie(REFRESH_COOKIE, cookieOptions(REFRESH_PATH, true, 0));
  res.clearCookie(CSRF_COOKIE, cookieOptions(ACCESS_PATH, false, 0));
  res.clearCookie(REGISTRATION_COOKIE, cookieOptions(REGISTRATION_PATH, true, 0));
}

export const requestOtp = [
  asyncHandler(async (req, res) => {
    const input = req.body as RequestOtpInput;
    const result = await requestOtpService(
      input.phone,
      req.ip || req.socket.remoteAddress || 'unknown',
    );

    res.json({
      success: true,
      data: {
        message: result.message,
        resendAfterSeconds: result.resendAfterSeconds,
        ...(env.nodeEnv === 'development' &&
        env.otpDevSimulatorEnabled &&
        result.developmentOtp
          ? { developmentOtp: result.developmentOtp }
          : {}),
        ...(env.nodeEnv === 'development' &&
        env.otpDevSimulatorEnabled &&
        env.otpDevQuickLoginEnabled &&
        result.developmentQuickLogin
          ? { developmentQuickLogin: true }
          : {}),
      },
    });
  }),
];

export const verifyOtp = [
  asyncHandler(async (req, res) => {
    const input = req.body as VerifyOtpInput;
    const result = await verifyOtpService(input.phone, input.code);

    if (result.registrationRequired) {
      res.cookie(
        REGISTRATION_COOKIE,
        result.registrationToken,
        cookieOptions(REGISTRATION_PATH, true, 5 * 60 * 1000),
      );
      setCsrfCookie(res, result.csrfToken);
      res.json({
        success: true,
        data: { registrationRequired: true, csrfToken: result.csrfToken },
      });
      return;
    }

    setSessionCookies(res, result);
    res.json({
      success: true,
      data: { registrationRequired: false, csrfToken: result.csrfToken },
    });
  }),
];

export const register = [
  requireCsrf,
  asyncHandler(async (req, res) => {
    const registrationToken = getCookie(req, REGISTRATION_COOKIE);

    if (!registrationToken) {
      throw new HttpError(401, 'REGISTRATION_REQUIRED', 'فرآیند ثبت‌نام معتبر نیست.');
    }

    const result = await completeRegistration(
      registrationToken,
      req.body as CompleteRegistrationInput,
    );
    setSessionCookies(res, result.tokens);
    res.clearCookie(REGISTRATION_COOKIE, cookieOptions(REGISTRATION_PATH, true, 0));
    res.status(201).json({
      success: true,
      data: { profile: result.profile, csrfToken: result.tokens.csrfToken },
    });
  }),
];

export const refresh = [
  requireCsrf,
  asyncHandler(async (req, res) => {
    const refreshToken = getCookie(req, REFRESH_COOKIE);

    if (!refreshToken) {
      throw new HttpError(401, 'SESSION_INVALID', 'نشست معتبر نیست. دوباره وارد شوید.');
    }

    const tokens = await rotateRefreshToken(refreshToken);
    setSessionCookies(res, tokens);
    res.json({
      success: true,
      data: { refreshed: true, csrfToken: tokens.csrfToken },
    });
  }),
];

export const recordActivity = [
  requireCsrf,
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'برای ادامه وارد حساب خود شوید.');
    }

    await recordSessionActivity(req.user.sessionId, req.user.userId);
    res.json({ success: true, data: { active: true } });
  }),
];

export const logout = [
  requireCsrf,
  asyncHandler(async (req, res) => {
    await revokeRefreshSession(getCookie(req, REFRESH_COOKIE));
    clearAuthCookies(res);
    res.json({ success: true, message: 'با موفقیت خارج شدید.' });
  }),
];

export const csrfBootstrap = [
  requireOrigin,
  (_req: Request, res: Response) => {
    const csrfToken = randomBytes(32).toString('base64url');
    setCsrfCookie(res, csrfToken);
    res.json({ success: true, data: { csrfToken } });
  },
];

export const getCurrentProfile: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'برای ادامه وارد حساب خود شوید.');
  }

  const profile = await getProfile(req.user.userId);
  res.json({ success: true, data: { profile } });
});

export const patchCurrentProfile = [
  requireCsrf,
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'برای ادامه وارد حساب خود شوید.');
    }

    const profile = await updateProfile(
      req.user.userId,
      req.body as UpdateProfileInput,
    );
    res.json({ success: true, data: { profile } });
  }),
];

export const scheduleAccountDeletion = [
  requireCsrf,
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'برای ادامه وارد حساب خود شوید.');
    }

    const result = await scheduleAccountDeletionService(
      req.user.userId,
      (req.body as AccountDeletionInput).code,
    );
    clearAuthCookies(res);
    res.json({
      success: true,
      data: result,
      message: 'درخواست حذف ثبت شد؛ دسترسی حساب فوراً بسته و داده‌ها پس از ۳۰ روز پاک می‌شوند.',
    });
  }),
];
