import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    amount: {
      type: Number,
      required: true,
      min: 1,
      max: 1_000_000_000_000,
      validate: Number.isSafeInteger,
    },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    date: { type: Date, required: true },
    note: { type: String, trim: true, maxlength: 200 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

transactionSchema.index({ userId: 1, deletedAt: 1, date: -1, _id: -1 });
transactionSchema.index({
  userId: 1,
  deletedAt: 1,
  categoryId: 1,
  date: -1,
  _id: -1,
});
transactionSchema.index({ userId: 1, deletedAt: 1, amount: 1, _id: -1 });
transactionSchema.index({ userId: 1, deletedAt: 1, amount: -1, _id: -1 });
transactionSchema.index({ userId: 1, type: 1, deletedAt: 1, categoryId: 1, date: 1 });

export default mongoose.model('Transaction', transactionSchema);
