const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amountPaise: { type: Number, required: true },
  method: { type: String, default: 'upi' },
  upiId: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending' },
  adminNote: { type: String, default: '' },
}, { timestamps: true });

withdrawalSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Withdrawal', withdrawalSchema);