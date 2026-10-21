import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, required: true, trim: true, maxlength: 50 },
    type: { type: String, enum: ['income', 'expense', 'both'], default: 'both' },
    icon: { type: String, default: 'wallet' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.index({ userId: 1, type: 1, name: 1 }, { unique: true });

export default mongoose.model('Category', categorySchema);
