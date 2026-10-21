import mongoose from 'mongoose';

const otpRateLimitSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    requestTimes: { type: [Date], required: true, default: [] },
    lastRequestId: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false },
);

otpRateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('OtpRateLimit', otpRateLimitSchema);
