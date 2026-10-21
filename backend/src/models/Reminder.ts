import mongoose from 'mongoose';

const reminderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    date: { type: Date, required: true },
    recurrence: { type: String, enum: ['none', 'monthly', 'yearly'], default: 'none' },
    amount: {
      type: Number,
      min: 1,
      max: 1_000_000_000_000,
      validate: (value: number | undefined) =>
        value === undefined || Number.isSafeInteger(value),
    },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

reminderSchema.index({ userId: 1, isActive: 1, date: 1 });

export default mongoose.model('Reminder', reminderSchema);
