const mongoose = require('mongoose');

/**
 * Spin & Win record.
 * - type 'free'  : a normal daily spin (counts against the daily limit)
 * - type 'ad'    : bonus spin earned by watching an ad (increases the daily quota by 1)
 */
const spinSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    dayKey: { type: String, required: true }, // YYYY-MM-DD
    type: { type: String, enum: ['free', 'ad'], default: 'free' },
    rewardIndex: { type: Number, default: -1 },
    rewardPaise: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Efficient lookups for "spin used today"
spinSchema.index({ userId: 1, dayKey: 1, type: 1 });

module.exports = mongoose.model('Spin', spinSchema);