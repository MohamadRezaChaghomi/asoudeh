import mongoose from 'mongoose';

const caregiverLinkSchema = new mongoose.Schema(
  {
    seniorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    caregiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    caregiverPhone: { type: String, trim: true, index: true },
    status: { type: String, enum: ['pending', 'active', 'revoked'], default: 'pending' },
    permissions: {
      readSummary: { type: Boolean, default: true },
      readTransactions: { type: Boolean, default: true },
      readReports: { type: Boolean, default: false },
    },
    respondedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

caregiverLinkSchema.index({ seniorId: 1, status: 1, createdAt: -1 });
caregiverLinkSchema.index({ caregiverPhone: 1, status: 1 });
caregiverLinkSchema.index({ caregiverId: 1, status: 1 });
caregiverLinkSchema.index(
  { seniorId: 1, caregiverPhone: 1 },
  {
    unique: true,
    name: 'active_caregiver_phone_unique',
    partialFilterExpression: {
      caregiverPhone: { $type: 'string' },
      status: { $in: ['pending', 'active'] },
    },
  },
);

export default mongoose.model('CaregiverLink', caregiverLinkSchema);
