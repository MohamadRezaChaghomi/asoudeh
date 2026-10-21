import mongoose from 'mongoose';

const caregiverLinkSchema = new mongoose.Schema(
  {
    seniorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    caregiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['pending', 'active', 'revoked'], default: 'pending' },
    permissions: {
      readSummary: { type: Boolean, default: true },
      readTransactions: { type: Boolean, default: true },
    },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('CaregiverLink', caregiverLinkSchema);
