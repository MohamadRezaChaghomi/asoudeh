import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 50 },
    type: { type: String, enum: ['income', 'expense'], required: true },
    icon: { type: String, trim: true, minlength: 1, default: 'wallet' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.index({ userId: 1, type: 1, name: 1 }, { unique: true });

export default mongoose.model('Category', categorySchema);
