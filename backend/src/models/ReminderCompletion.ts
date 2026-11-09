import mongoose from 'mongoose';
import { getJalaliMonthRange } from '../utils/jalaliMonth.js';

const reminderCompletionSchema = new mongoose.Schema(
  {
    reminderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reminder',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    monthKey: {
      type: String,
      required: true,
      match: /^(0[1-9]|1[0-2])-(12\d{2}|13\d{2}|14\d{2}|15\d{2}|1600)$/,
      validate: {
        validator: (value: string) => {
          const [month, year] = value.split('-');
          try {
            getJalaliMonthRange(Number(year), Number(month));
            return true;
          } catch {
            return false;
          }
        },
        message: 'monthKey must be a valid Solar Hijri month.',
      },
    },
    completedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

reminderCompletionSchema.index(
  { reminderId: 1, monthKey: 1 },
  { unique: true, name: 'reminder_month_completion_unique' },
);
reminderCompletionSchema.index({ userId: 1, monthKey: 1 });
reminderCompletionSchema.index({ userId: 1, reminderId: 1, completedAt: -1 });

export default mongoose.model('ReminderCompletion', reminderCompletionSchema);
