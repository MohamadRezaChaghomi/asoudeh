import mongoose from 'mongoose';

const otpChallengeSchema = new mongoose.Schema(
  {
    phoneHash: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    otpHash: { type: String, default: null },
    deliveryMode: { type: String, enum: ['development', 'sms'], default: 'development' },
    lastSentAt: { type: Date, default: null },
    sendLockId: { type: String, default: null },
    sendLockExpiresAt: { type: Date, default: null },
    failedAttempts: { type: Number, required: true, default: 0 },
    attemptWindowStartedAt: { type: Date, default: null },
    blockedUntil: { type: Date, default: null },
    codeExpiresAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    deleteAt: { type: Date, required: true },
  },
  { timestamps: true },
);

otpChallengeSchema.index({ deleteAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('OtpChallenge', otpChallengeSchema);
