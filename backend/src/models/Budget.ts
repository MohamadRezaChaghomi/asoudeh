import mongoose from 'mongoose';
import { getJalaliMonthRange } from '../utils/jalaliMonth.js';

const budgetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    monthKey: {
      type: String,
      required: true,
      match: /^(0[1-9]|1[0-2])-(12\d{2}|13\d{2}|14\d{2}|15\d{2}|1600)$/,
      validate: {
        validator: (value: string) => {
          if (!/^(0[1-9]|1[0-2])-(12\d{2}|13\d{2}|14\d{2}|15\d{2}|1600)$/.test(value)) {
            return false;
          }
          const [monthText, yearText] = value.split('-');
          try {
            getJalaliMonthRange(Number(yearText), Number(monthText));
            return true;
          } catch {
            return false;
          }
        },
        message: 'monthKey must be a valid Solar Hijri month.',
      },
    },
    limitAmount: {
      type: Number,
      required: true,
      min: 1,
      max: 1_000_000_000_000,
      validate: Number.isSafeInteger,
    },
  },
  { timestamps: true }
);

budgetSchema.index({ userId: 1, categoryId: 1, monthKey: 1 }, { unique: true });
budgetSchema.index({ userId: 1, monthKey: 1 });

export default mongoose.model('Budget', budgetSchema);
