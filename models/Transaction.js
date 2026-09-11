const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { 
    type: String, 
    enum: ['spin_reward', 'ad_reward', 'quiz_reward', 'task_reward', 'task_reward_reversal', 'bonus', 'withdrawal', 'withdrawal_reversal', 'admin_credit', 'admin_debit', 'admin_reversal'],
    required: true 
  },
  amountPaise: { type: Number, required: true },
  balanceAfterPaise: { type: Number, required: true },
  referenceId: { type: String, default: '' },
}, { timestamps: true });

transactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);