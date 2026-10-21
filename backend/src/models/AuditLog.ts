import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: {
      type: String,
      enum: [
        'caregiver.invited',
        'caregiver.accepted',
        'caregiver.rejected',
        'caregiver.revoked',
        'caregiver.summary_viewed',
        'caregiver.transactions_viewed',
        'caregiver.report_viewed',
      ],
      required: true,
    },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true },
);

auditLogSchema.index({ targetUserId: 1, createdAt: -1 });

export default mongoose.model('AuditLog', auditLogSchema);
