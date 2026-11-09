import mongoose from 'mongoose';

const CURRENT_SOLAR_HIJRI_YEAR = Number(
  new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' })
    .format(new Date())
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0)),
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    phone: { type: String, unique: true, sparse: true, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    birthYear: {
      type: Number,
      min: 1300,
      max: CURRENT_SOLAR_HIJRI_YEAR,
      validate: (value: number | null | undefined) =>
        value == null || Number.isInteger(value),
    },
    initialBalance: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: Number.isSafeInteger,
    },
    role: { type: String, enum: ['senior', 'caregiver', 'admin'], default: 'senior' },
    deletionRequestedAt: { type: Date, default: null },
    deletionScheduledAt: { type: Date, default: null },
    accessibilitySettings: {
      fontScale: { type: Number, enum: [1, 1.25, 1.5, 2], default: 1 },
      highContrast: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

userSchema.index({ deletionScheduledAt: 1, _id: 1 });

export default mongoose.model('User', userSchema);
