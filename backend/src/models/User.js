import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, unique: true, sparse: true, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    role: { type: String, enum: ['senior', 'caregiver', 'admin'], default: 'senior' },
    accessibilitySettings: {
      fontScale: { type: Number, default: 1 },
      highContrast: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
