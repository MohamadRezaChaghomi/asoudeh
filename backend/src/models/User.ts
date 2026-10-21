import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, unique: true, sparse: true, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    birthYear: { type: Number, min: 1300 },
    initialBalance: { type: Number, required: true, min: 0, default: 0 },
    role: { type: String, enum: ['senior', 'caregiver', 'admin'], default: 'senior' },
    deletionRequestedAt: { type: Date, default: null },
    deletionScheduledAt: { type: Date, default: null },
    accessibilitySettings: {
      fontScale: { type: Number, default: 1 },
      highContrast: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

userSchema.index({ deletionScheduledAt: 1 });

export default mongoose.model('User', userSchema);
