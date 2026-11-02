import mongoose from 'mongoose';

const assistantRateLimitSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    requestCount: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false },
);

assistantRateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('AssistantRateLimit', assistantRateLimitSchema);
