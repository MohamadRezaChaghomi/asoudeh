import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import AuthSession, { AUTH_SESSION_IDLE_TIMEOUT_MS } from '../models/AuthSession.js';
import OtpChallenge from '../models/OtpChallenge.js';
import OtpRateLimit from '../models/OtpRateLimit.js';
import User from '../models/User.js';
import {
  generateId,
  generateOtp,
  generateOpaqueToken,
  hashAuthValue,
  hashOtp,
  normalizeIranianMobile,
  secureStringEqual,
} from '../utils/authCrypto.js';
import { HttpError } from '../utils/httpError.js';
import { sendSmsIrOtp, SmsIrProviderError } from './smsIrProvider.js';
import type {
  CompleteRegistrationInput,
  UpdateProfileInput,
} from '../validators/auth.validator.js';

const OTP_LIFETIME_MS = 5 * 60 * 1000;
const OTP_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const OTP_BLOCK_MS = 10 * 60 * 1000;
const OTP_REQUEST_WINDOW_MS = 15 * 60 * 1000;
const OTP_PHONE_REQUEST_LIMIT = 3;
const OTP_IP_REQUEST_LIMIT = 10;
const REGISTRATION_LIFETIME_SECONDS = 5 * 60;
const ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60;
const REFRESH_TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const ACCOUNT_DELETION_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
const OTP_SEND_LOCK_MS = 15 * 1000;
const OTP_MESSAGE = 'اگر شماره همراه معتبر باشد، کد تأیید ارسال می‌شود.';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}

export interface OtpRequestResult {
  message: string;
  developmentOtp?: string;
  developmentQuickLogin?: boolean;
  deliveryMode: 'development' | 'sms';
  resendAfterSeconds: number;
}

export type OtpVerificationResult =
  | { registrationRequired: true; registrationToken: string; csrfToken: string }
  | ({ registrationRequired: false } & AuthTokens);

export interface PublicProfile {
  id: string;
  displayName: string;
  phone: string;
  birthYear: number | null;
  initialBalance: number;
  accessibilitySettings: {
    fontScale: number;
    highContrast: boolean;
  };
}

function retryAfterSeconds(until: Date, now: Date): number {
  return Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 1000));
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}

async function consumeRateLimit(
  scope: 'phone' | 'ip',
  subject: string,
  maximum: number,
  now: Date,
): Promise<void> {
  const id = hashAuthValue('otp-rate-limit', `${scope}\0${subject}`);
  const cutoff = new Date(now.getTime() - OTP_REQUEST_WINDOW_MS);
  const requestId = generateId();
  const recentRequests = {
    $filter: {
      input: { $ifNull: ['$requestTimes', []] },
      as: 'requestAt',
      cond: { $gt: ['$$requestAt', cutoff] },
    },
  };
  const hasCapacity = {
    $lt: [{ $size: recentRequests }, maximum],
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const updated = await OtpRateLimit.findOneAndUpdate(
        { _id: id },
        [
          {
            $set: {
              requestTimes: {
                $cond: [
                  hasCapacity,
                  { $concatArrays: [recentRequests, { $literal: [now] }] },
                  recentRequests,
                ],
              },
              lastRequestId: {
                $cond: [hasCapacity, { $literal: requestId }, '$lastRequestId'],
              },
              expiresAt: new Date(now.getTime() + OTP_REQUEST_WINDOW_MS),
            },
          },
        ],
        { upsert: true, new: true },
      ).lean();

      if (!updated) {
        continue;
      }

      if (updated.lastRequestId !== requestId) {
        const oldest = new Date(String(updated.requestTimes[0]));
        throw new HttpError(
          429,
          'OTP_RATE_LIMITED',
          'تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.',
          retryAfterSeconds(
            new Date(oldest.getTime() + OTP_REQUEST_WINDOW_MS),
            now,
          ),
        );
      }
      return;
    } catch (error) {
      if (error instanceof HttpError || !isDuplicateKey(error)) {
        throw error;
      }
    }
  }

  throw new HttpError(503, 'RATE_LIMIT_UNAVAILABLE', 'امکان بررسی درخواست وجود ندارد.');
}

function createAccessToken(userId: string, sessionId: string): string {
  return jwt.sign({ purpose: 'access', sid: sessionId }, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: ACCESS_TOKEN_LIFETIME_SECONDS,
    subject: userId,
  });
}

async function createSession(
  userId: string,
  familyId: string = generateId(),
  now: Date = new Date(),
): Promise<AuthTokens> {
  const activeUser = await User.exists({
    _id: new mongoose.Types.ObjectId(userId),
    deletionScheduledAt: null,
  });
  if (!activeUser) {
    throw new HttpError(409, 'ACCOUNT_DELETION_PENDING', 'این حساب در صف حذف قرار دارد.');
  }

  const refreshToken = generateOpaqueToken();
  const session = await AuthSession.create({
    userId: new mongoose.Types.ObjectId(userId),
    familyId,
    tokenHash: hashAuthValue('refresh-token', refreshToken),
    expiresAt: new Date(now.getTime() + REFRESH_TOKEN_LIFETIME_MS),
    idleExpiresAt: new Date(now.getTime() + AUTH_SESSION_IDLE_TIMEOUT_MS),
  });

  return {
    accessToken: createAccessToken(userId, session.id),
    refreshToken,
    csrfToken: generateOpaqueToken(),
  };
}

function getRegistrationClaims(token: string): string {
  try {
    const decoded = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });

    if (
      typeof decoded === 'string' ||
      decoded.purpose !== 'registration' ||
      typeof decoded.phoneHash !== 'string'
    ) {
      throw new Error('Invalid registration claims');
    }

    return decoded.phoneHash;
  } catch {
    throw new HttpError(401, 'REGISTRATION_REQUIRED', 'فرآیند ثبت‌نام معتبر نیست.');
  }
}

function mapProfile(user: {
  _id: unknown;
  name: string;
  phone?: string | null;
  birthYear?: number | null;
  initialBalance?: number;
  accessibilitySettings?: { fontScale?: number; highContrast?: boolean } | null;
}): PublicProfile {
  return {
    id: String(user._id),
    displayName: user.name,
    phone: user.phone || '',
    birthYear: user.birthYear ?? null,
    initialBalance: user.initialBalance ?? 0,
    accessibilitySettings: {
      fontScale: user.accessibilitySettings?.fontScale ?? 1,
      highContrast: user.accessibilitySettings?.highContrast ?? false,
    },
  };
}

export async function requestOtp(phone: string, ipAddress: string): Promise<OtpRequestResult> {
  const now = new Date();
  const normalizedPhone = normalizeIranianMobile(phone);
  if (!normalizedPhone) {
    throw new HttpError(400, 'INVALID_PHONE', 'شماره همراه معتبر ایرانی وارد کنید.');
  }
  const phoneHash = hashAuthValue('phone', normalizedPhone);
  const current = await OtpChallenge.findOne({ phoneHash });

  if (current?.blockedUntil && current.blockedUntil > now) {
    throw new HttpError(
      429,
      'OTP_TEMPORARILY_BLOCKED',
      'تلاش‌های کد تأیید موقتاً مسدود شده‌اند. کمی بعد دوباره تلاش کنید.',
      retryAfterSeconds(current.blockedUntil, now),
    );
  }

  const resendCooldownMs = env.otpResendCooldownSeconds * 1000;
  if (current?.lastSentAt && now.getTime() - current.lastSentAt.getTime() < resendCooldownMs) {
    throw new HttpError(
      429,
      'OTP_RATE_LIMITED',
      'برای ارسال دوباره کد کمی صبر کنید.',
      retryAfterSeconds(new Date(current.lastSentAt.getTime() + resendCooldownMs), now),
    );
  }

  const useDevelopmentSimulator =
    env.nodeEnv === 'development' && env.otpDevSimulatorEnabled;
  if (!useDevelopmentSimulator && env.smsIrMode !== 'production') {
    throw new HttpError(
      503,
      'SMSIR_SANDBOX_UNAVAILABLE',
      'حالت sandbox در مستندات رسمی SMS.ir تأیید نشده است؛ برای توسعه از شبیه‌ساز و برای ارسال واقعی پس از تأیید، حالت production را انتخاب کنید.',
    );
  }

  const code = useDevelopmentSimulator ? env.otpDevFallbackCode : generateOtp();
  const codeHash = hashOtp(normalizedPhone, code);
  await consumeRateLimit('phone', normalizedPhone, OTP_PHONE_REQUEST_LIMIT, now);
  await consumeRateLimit('ip', ipAddress, OTP_IP_REQUEST_LIMIT, now);

  const requestId = generateId();
  const lockExpiresAt = new Date(now.getTime() + OTP_SEND_LOCK_MS);
  let challengeId = '';
  try {
    const challenge = await OtpChallenge.findOneAndUpdate(
      {
        phoneHash,
        $and: [
          {
            $or: [
              { lastSentAt: null },
              { lastSentAt: { $lte: new Date(now.getTime() - resendCooldownMs) } },
            ],
          },
          {
            $or: [
              { sendLockExpiresAt: null },
              { sendLockExpiresAt: { $lte: now } },
            ],
          },
        ],
      },
      {
        $set: { sendLockId: requestId, sendLockExpiresAt: lockExpiresAt },
        $setOnInsert: {
          phone: normalizedPhone,
          phoneHash,
          deleteAt: new Date(now.getTime() + OTP_LIFETIME_MS + OTP_BLOCK_MS),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    if (!challenge) {
      throw new HttpError(
        429,
        'OTP_RATE_LIMITED',
        'درخواست کد در حال پردازش است؛ کمی بعد دوباره تلاش کنید.',
        Math.ceil(OTP_SEND_LOCK_MS / 1000),
      );
    }
    challengeId = String(challenge._id);
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    throw new HttpError(
      429,
      'OTP_RATE_LIMITED',
      'درخواست کد در حال پردازش است؛ کمی بعد دوباره تلاش کنید.',
      Math.ceil(OTP_SEND_LOCK_MS / 1000),
    );
  }

  const resetAttempts =
    !current?.attemptWindowStartedAt ||
    now.getTime() - current.attemptWindowStartedAt.getTime() >= OTP_ATTEMPT_WINDOW_MS;

  try {
    if (!useDevelopmentSimulator) {
      await sendSmsIrOtp(normalizedPhone, code);
    }

    const updatedChallenge = await OtpChallenge.findOneAndUpdate(
      {
        _id: challengeId,
        sendLockId: requestId,
      },
      {
        $set: {
          phone: normalizedPhone,
          otpHash: codeHash,
          deliveryMode: useDevelopmentSimulator ? 'development' : 'sms',
          lastSentAt: now,
          codeExpiresAt: new Date(now.getTime() + OTP_LIFETIME_MS),
          verifiedAt: null,
          deleteAt: new Date(now.getTime() + OTP_BLOCK_MS + OTP_LIFETIME_MS),
          ...(resetAttempts
            ? { failedAttempts: 0, attemptWindowStartedAt: null, blockedUntil: null }
            : {}),
        },
        $unset: { sendLockId: 1, sendLockExpiresAt: 1 },
      },
      { new: true },
    );
    if (!updatedChallenge) {
      throw new HttpError(
        503,
        'OTP_DELIVERY_UNAVAILABLE',
        'ثبت درخواست کد انجام نشد؛ دوباره تلاش کنید.',
      );
    }
  } catch (error) {
    await OtpChallenge.updateOne(
      { _id: challengeId, sendLockId: requestId },
      { $unset: { sendLockId: 1, sendLockExpiresAt: 1 } },
    );

    if (error instanceof SmsIrProviderError) {
      console.error('SMS.ir OTP request failed.', {
        correlationId: requestId,
        category: error.category,
        ...(error.httpStatus ? { httpStatus: error.httpStatus } : {}),
      });
      const configurationFailure = [
        'missing_api_key',
        'invalid_template_id',
        'missing_parameter_name',
        'invalid_base_url',
      ].includes(error.category);
      const message = configurationFailure
        ? 'تنظیمات SMS.ir ناقص یا نامعتبر است؛ API key، template ID، نام پارامتر و نشانی API را بررسی کنید.'
        : 'ارسال کد تأیید انجام نشد. تنظیمات SMS.ir یا وضعیت سرویس را بررسی کنید.';
      throw new HttpError(
        503,
        configurationFailure ? 'SMSIR_CONFIGURATION_ERROR' : 'OTP_DELIVERY_UNAVAILABLE',
        message,
      );
    }
    throw error;
  }

  return {
    message: OTP_MESSAGE,
    deliveryMode: useDevelopmentSimulator ? 'development' : 'sms',
    ...(useDevelopmentSimulator ? { developmentOtp: code } : {}),
    ...(useDevelopmentSimulator &&
    env.otpDevQuickLoginEnabled &&
    env.nodeEnv === 'development' &&
    normalizedPhone === env.otpDevQuickLoginPhone
      ? { developmentQuickLogin: true }
      : {}),
    resendAfterSeconds: env.otpResendCooldownSeconds,
  };
}

async function recordFailedAttempt(
  phoneHash: string,
  codeHash: string,
  now: Date,
): Promise<void> {
  const previousAttempts = { $ifNull: ['$failedAttempts', 0] };
  const attemptWindowActive = {
    $gt: [
      { $ifNull: ['$attemptWindowStartedAt', new Date(0)] },
      new Date(now.getTime() - OTP_ATTEMPT_WINDOW_MS),
    ],
  };
  const attemptsBefore = {
    $cond: [attemptWindowActive, previousAttempts, 0],
  };
  const attemptsAfter = { $add: [attemptsBefore, 1] };
  const result = await OtpChallenge.findOneAndUpdate(
    {
      phoneHash,
      otpHash: codeHash,
      codeExpiresAt: { $gt: now },
      failedAttempts: { $lt: 5 },
      $or: [{ blockedUntil: null }, { blockedUntil: { $lte: now } }],
    },
    [
      {
        $set: {
          failedAttempts: attemptsAfter,
          attemptWindowStartedAt: {
            $cond: [attemptWindowActive, '$attemptWindowStartedAt', now],
          },
          blockedUntil: {
            $cond: [
              { $gte: [attemptsAfter, 5] },
              new Date(now.getTime() + OTP_BLOCK_MS),
              null,
            ],
          },
        },
      },
    ],
    { new: true },
  ).lean();

  if (result?.failedAttempts === 5) {
    throw new HttpError(
      429,
      'OTP_TEMPORARILY_BLOCKED',
      'پس از پنج تلاش ناموفق، ورود برای ۱۰ دقیقه مسدود شد.',
      Math.ceil(OTP_BLOCK_MS / 1000),
    );
  }

  throw new HttpError(400, 'OTP_INVALID', 'کد تأیید معتبر نیست یا منقضی شده است.');
}

export async function verifyOtp(
  phone: string,
  code: string,
): Promise<OtpVerificationResult> {
  const now = new Date();
  const phoneHash = hashAuthValue('phone', phone);
  const challenge = await OtpChallenge.findOne({ phoneHash });

  if (challenge?.blockedUntil && challenge.blockedUntil > now) {
    throw new HttpError(
      429,
      'OTP_TEMPORARILY_BLOCKED',
      'تلاش‌های کد تأیید موقتاً مسدود شده‌اند. کمی بعد دوباره تلاش کنید.',
      retryAfterSeconds(challenge.blockedUntil, now),
    );
  }

  if (!challenge?.otpHash || !challenge.codeExpiresAt || challenge.codeExpiresAt <= now) {
    throw new HttpError(400, 'OTP_INVALID', 'کد تأیید معتبر نیست یا منقضی شده است.');
  }
  if (
    challenge.deliveryMode !== 'sms' &&
    (env.nodeEnv !== 'development' || !env.otpDevSimulatorEnabled)
  ) {
    throw new HttpError(400, 'OTP_INVALID', 'کد تأیید معتبر نیست یا منقضی شده است.');
  }

  const submittedHash = hashOtp(phone, code);

  if (!secureStringEqual(challenge.otpHash, submittedHash)) {
    await recordFailedAttempt(phoneHash, challenge.otpHash, now);
  }

  const user = await User.findOne({ phone });

  if (user) {
    if (user.deletionScheduledAt) {
      throw new HttpError(
        409,
        'ACCOUNT_DELETION_PENDING',
        'این حساب در صف حذف قرار دارد و امکان ورود ندارد.',
      );
    }

    const consumed = await OtpChallenge.findOneAndDelete({
      _id: challenge._id,
      otpHash: challenge.otpHash,
      codeExpiresAt: { $gt: now },
      failedAttempts: { $lt: 5 },
      $or: [{ blockedUntil: null }, { blockedUntil: { $lte: now } }],
    });

    if (!consumed) {
      throw new HttpError(400, 'OTP_INVALID', 'کد تأیید معتبر نیست یا منقضی شده است.');
    }

    return { registrationRequired: false, ...(await createSession(user.id, undefined, now)) };
  }

  const consumed = await OtpChallenge.findOneAndUpdate(
    {
      _id: challenge._id,
      otpHash: challenge.otpHash,
      codeExpiresAt: { $gt: now },
      failedAttempts: { $lt: 5 },
      verifiedAt: null,
      $or: [{ blockedUntil: null }, { blockedUntil: { $lte: now } }],
    },
    {
      $set: {
        otpHash: null,
        codeExpiresAt: new Date(now.getTime() + REGISTRATION_LIFETIME_SECONDS * 1000),
        verifiedAt: now,
        deleteAt: new Date(now.getTime() + REGISTRATION_LIFETIME_SECONDS * 1000),
      },
    },
    { new: true },
  );

  if (!consumed) {
    throw new HttpError(400, 'OTP_INVALID', 'کد تأیید معتبر نیست یا منقضی شده است.');
  }

  const registrationToken = jwt.sign(
    { purpose: 'registration', phoneHash },
    env.jwtSecret,
    {
      algorithm: 'HS256',
      expiresIn: REGISTRATION_LIFETIME_SECONDS,
    },
  );

  return {
    registrationRequired: true,
    registrationToken,
    csrfToken: generateOpaqueToken(),
  };
}

export async function completeRegistration(
  registrationToken: string,
  input: CompleteRegistrationInput,
): Promise<{ profile: PublicProfile; tokens: AuthTokens }> {
  const phoneHash = getRegistrationClaims(registrationToken);
  const now = new Date();
  const challenge = await OtpChallenge.findOne({
    phoneHash,
    verifiedAt: { $gt: new Date(now.getTime() - REGISTRATION_LIFETIME_SECONDS * 1000) },
    deleteAt: { $gt: now },
  });

  if (!challenge) {
    throw new HttpError(401, 'REGISTRATION_REQUIRED', 'فرآیند ثبت‌نام معتبر نیست.');
  }

  let user;
  try {
    user = await User.create({
      name: input.displayName,
      phone: challenge.phone,
      initialBalance: 0,
    });
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw new HttpError(409, 'ACCOUNT_ALREADY_EXISTS', 'این شماره همراه قبلاً ثبت شده است.');
    }
    throw error;
  }
  await OtpChallenge.deleteOne({ _id: challenge._id });

  return {
    profile: mapProfile(user),
    tokens: await createSession(user.id, undefined, now),
  };
}

export async function rotateRefreshToken(refreshToken: string): Promise<AuthTokens> {
  const now = new Date();
  const tokenHash = hashAuthValue('refresh-token', refreshToken);
  const current = await AuthSession.findOne({ tokenHash });

  if (!current) {
    throw new HttpError(401, 'SESSION_INVALID', 'نشست معتبر نیست. دوباره وارد شوید.');
  }

  if (current.rotatedAt || current.revokedAt) {
    await AuthSession.updateMany(
      { familyId: current.familyId, revokedAt: null },
      { $set: { revokedAt: now } },
    );
    throw new HttpError(401, 'REFRESH_TOKEN_REUSED', 'نشست امنیتی لغو شد. دوباره وارد شوید.');
  }

  if (!current.idleExpiresAt || current.idleExpiresAt <= now) {
    await AuthSession.updateMany(
      { familyId: current.familyId, revokedAt: null },
      { $set: { revokedAt: now } },
    );
    throw new HttpError(401, 'SESSION_EXPIRED', 'به‌دلیل بی‌کاری، نشست منقضی شده است.');
  }

  if (current.expiresAt <= now) {
    await AuthSession.updateOne({ _id: current._id }, { $set: { revokedAt: now } });
    throw new HttpError(401, 'SESSION_EXPIRED', 'نشست منقضی شده است. دوباره وارد شوید.');
  }

  const activeUser = await User.exists({
    _id: current.userId,
    deletionScheduledAt: null,
  });
  if (!activeUser) {
    await AuthSession.updateMany(
      { familyId: current.familyId, revokedAt: null },
      { $set: { revokedAt: now } },
    );
    throw new HttpError(401, 'SESSION_INVALID', 'این حساب دیگر فعال نیست.');
  }

  const nextRefreshToken = generateOpaqueToken();
  const nextTokenHash = hashAuthValue('refresh-token', nextRefreshToken);
  const successor = await AuthSession.create({
    userId: current.userId,
    familyId: current.familyId,
    tokenHash: nextTokenHash,
    expiresAt: current.expiresAt,
    idleExpiresAt: current.idleExpiresAt,
  });
  const claimed = await AuthSession.findOneAndUpdate(
    {
      _id: current._id,
      rotatedAt: null,
      revokedAt: null,
      expiresAt: { $gt: now },
      idleExpiresAt: { $gt: now },
    },
    { $set: { rotatedAt: now, replacedBy: nextTokenHash } },
    { new: true },
  );

  if (!claimed) {
    await AuthSession.updateOne(
      { _id: successor._id, revokedAt: null },
      { $set: { revokedAt: now } },
    );
    const latest = await AuthSession.findById(current._id);

    if (latest?.rotatedAt) {
      await AuthSession.updateMany(
        { familyId: current.familyId, revokedAt: null },
        { $set: { revokedAt: now } },
      );
    }
    throw new HttpError(401, 'REFRESH_TOKEN_REUSED', 'نشست امنیتی لغو شد. دوباره وارد شوید.');
  }

  return {
    accessToken: createAccessToken(current.userId.toString(), successor.id),
    refreshToken: nextRefreshToken,
    csrfToken: generateOpaqueToken(),
  };
}

export async function recordSessionActivity(
  sessionId: string,
  userId: string,
): Promise<void> {
  const now = new Date();
  const updated = await AuthSession.findOneAndUpdate(
    {
      _id: sessionId,
      userId,
      rotatedAt: null,
      revokedAt: null,
      expiresAt: { $gt: now },
      idleExpiresAt: { $gt: now },
    },
    { $set: { idleExpiresAt: new Date(now.getTime() + AUTH_SESSION_IDLE_TIMEOUT_MS) } },
    { new: true },
  ).select('_id');

  if (!updated) {
    throw new HttpError(401, 'SESSION_EXPIRED', 'نشست منقضی شده است. دوباره وارد شوید.');
  }
}

export async function revokeRefreshSession(refreshToken?: string): Promise<void> {
  if (!refreshToken) {
    return;
  }

  const session = await AuthSession.findOne({
    tokenHash: hashAuthValue('refresh-token', refreshToken),
  });

  if (session) {
    await AuthSession.updateMany(
      { familyId: session.familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }
}

export async function getProfile(userId: string): Promise<PublicProfile> {
  const user = await User.findById(userId);

  if (!user) {
    throw new HttpError(401, 'SESSION_INVALID', 'نشست معتبر نیست. دوباره وارد شوید.');
  }

  return mapProfile(user);
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<PublicProfile> {
  const updates: Record<string, string | number | null | boolean> = {};

  if (input.displayName !== undefined) {
    updates.name = input.displayName;
  }
  if (input.birthYear !== undefined) {
    updates.birthYear = input.birthYear;
  }
  if (input.initialBalance !== undefined) {
    updates.initialBalance = input.initialBalance;
  }
  if (input.accessibilitySettings?.fontScale !== undefined) {
    updates['accessibilitySettings.fontScale'] = input.accessibilitySettings.fontScale;
  }
  if (input.accessibilitySettings?.highContrast !== undefined) {
    updates['accessibilitySettings.highContrast'] = input.accessibilitySettings.highContrast;
  }

  const user = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true });

  if (!user) {
    throw new HttpError(401, 'SESSION_INVALID', 'نشست معتبر نیست. دوباره وارد شوید.');
  }

  return mapProfile(user);
}

export async function scheduleAccountDeletion(
  userId: string,
  code: string,
): Promise<{ scheduledFor: string }> {
  const user = await User.findById(userId).select('phone deletionScheduledAt').lean();
  if (!user?.phone) {
    throw new HttpError(404, 'ACCOUNT_NOT_FOUND', 'حساب کاربری پیدا نشد.');
  }
  if (user.deletionScheduledAt) {
    throw new HttpError(409, 'ACCOUNT_DELETION_PENDING', 'این حساب از قبل در صف حذف است.');
  }

  const now = new Date();
  const phoneHash = hashAuthValue('phone', user.phone);
  const challenge = await OtpChallenge.findOne({ phoneHash });
  if (
    challenge?.deliveryMode !== 'sms' &&
    (env.nodeEnv !== 'development' || !env.otpDevSimulatorEnabled)
  ) {
    throw new HttpError(400, 'OTP_INVALID', 'کد تأیید معتبر نیست یا منقضی شده است.');
  }
  if (challenge?.blockedUntil && challenge.blockedUntil > now) {
    throw new HttpError(
      429,
      'OTP_TEMPORARILY_BLOCKED',
      'تلاش‌های کد تأیید موقتاً مسدود شده‌اند. کمی بعد دوباره تلاش کنید.',
      retryAfterSeconds(challenge.blockedUntil, now),
    );
  }
  if (
    !challenge?.otpHash ||
    !challenge.codeExpiresAt ||
    challenge.codeExpiresAt <= now ||
    challenge.failedAttempts >= 5
  ) {
    throw new HttpError(400, 'OTP_INVALID', 'کد تأیید معتبر نیست یا منقضی شده است.');
  }

  const submittedHash = hashOtp(user.phone, code);
  if (!secureStringEqual(challenge.otpHash, submittedHash)) {
    await recordFailedAttempt(phoneHash, challenge.otpHash, now);
  }

  const consumed = await OtpChallenge.findOneAndDelete({
    _id: challenge._id,
    otpHash: challenge.otpHash,
    codeExpiresAt: { $gt: now },
    failedAttempts: { $lt: 5 },
    $or: [{ blockedUntil: null }, { blockedUntil: { $lte: now } }],
  });
  if (!consumed) {
    throw new HttpError(400, 'OTP_INVALID', 'کد تأیید معتبر نیست یا منقضی شده است.');
  }

  const scheduledFor = new Date(now.getTime() + ACCOUNT_DELETION_GRACE_PERIOD_MS);
  const marked = await User.findOneAndUpdate(
    { _id: user._id, deletionScheduledAt: null },
    {
      $set: {
        deletionRequestedAt: now,
        deletionScheduledAt: scheduledFor,
      },
    },
    { new: true },
  ).lean();
  if (!marked) {
    throw new HttpError(409, 'ACCOUNT_DELETION_PENDING', 'این حساب دیگر فعال نیست.');
  }

  await AuthSession.updateMany(
    { userId: user._id, revokedAt: null },
    { $set: { revokedAt: now } },
  );

  return { scheduledFor: scheduledFor.toISOString() };
}
