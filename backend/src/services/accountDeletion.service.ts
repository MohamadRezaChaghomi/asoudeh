import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import AssistantRateLimit from '../models/AssistantRateLimit.js';
import AuditLog from '../models/AuditLog.js';
import AuthSession from '../models/AuthSession.js';
import Budget from '../models/Budget.js';
import CaregiverLink from '../models/CaregiverLink.js';
import Category from '../models/Category.js';
import OtpChallenge from '../models/OtpChallenge.js';
import OtpRateLimit from '../models/OtpRateLimit.js';
import Reminder from '../models/Reminder.js';
import ReminderCompletion from '../models/ReminderCompletion.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { hashAuthValue } from '../utils/authCrypto.js';
import { logger } from '../utils/logger.js';

const ACCOUNT_DELETION_BATCH_SIZE = 100;

async function purgeAccount(
  user: { _id: mongoose.Types.ObjectId; phone?: string | null },
  now: Date,
): Promise<boolean> {
  const userId = user._id;
  const assistantRateLimitPrefix = createHash('sha256')
    .update(userId.toString())
    .digest('hex');
  const phoneHash = user.phone ? hashAuthValue('phone', user.phone) : null;
  const phoneRateLimitIds = user.phone
    ? [
        hashAuthValue('otp-rate-limit', `phone\0${user.phone}`),
        hashAuthValue('otp-rate-limit', `verify-phone\0${user.phone}`),
      ]
    : [];

  await Promise.all([
    AssistantRateLimit.deleteMany({
      _id: { $regex: `^${assistantRateLimitPrefix}:` },
    }),
    AuditLog.deleteMany({ $or: [{ actorId: userId }, { targetUserId: userId }] }),
    AuthSession.deleteMany({ userId }),
    Budget.deleteMany({ userId }),
    CaregiverLink.deleteMany({
      $or: [
        { seniorId: userId },
        { caregiverId: userId },
        ...(user.phone ? [{ caregiverPhone: user.phone }] : []),
      ],
    }),
    Category.deleteMany({ userId }),
    ...(phoneHash ? [OtpChallenge.deleteMany({ phoneHash })] : []),
    ...(phoneRateLimitIds.length
      ? [OtpRateLimit.deleteMany({ _id: { $in: phoneRateLimitIds } })]
      : []),
    Reminder.deleteMany({ userId }),
    ReminderCompletion.deleteMany({ userId }),
    Transaction.deleteMany({ userId }),
  ]);

  const removed = await User.deleteOne({
    _id: userId,
    deletionScheduledAt: { $lte: now },
  });
  return removed.deletedCount === 1;
}

export async function purgeExpiredAccountDeletions(
  now: Date = new Date(),
): Promise<number> {
  const dueUsers = await User.find({ deletionScheduledAt: { $lte: now } })
    .select('_id phone')
    .sort({ deletionScheduledAt: 1, _id: 1 })
    .limit(ACCOUNT_DELETION_BATCH_SIZE)
    .lean<{ _id: mongoose.Types.ObjectId; phone?: string | null }[]>();

  let purgedCount = 0;
  for (const user of dueUsers) {
    try {
      if (await purgeScheduledAccountDeletion(user._id, now)) purgedCount += 1;
    } catch (error) {
      logger.error(
        { errorType: error instanceof Error ? error.name : 'UnknownError' },
        'account_deletion_purge_failed',
      );
    }
  }

  return purgedCount;
}

export async function purgeScheduledAccountDeletion(
  userId: mongoose.Types.ObjectId,
  now: Date = new Date(),
): Promise<boolean> {
  const user = await User.findOne({
    _id: userId,
    deletionScheduledAt: { $lte: now },
  })
    .select('_id phone')
    .lean<{ _id: mongoose.Types.ObjectId; phone?: string | null }>();
  return user ? purgeAccount(user, now) : false;
}
