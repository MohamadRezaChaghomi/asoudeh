import mongoose from 'mongoose';

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

export default mongoose.model('ReminderCompletion', reminderCompletionSchema);
