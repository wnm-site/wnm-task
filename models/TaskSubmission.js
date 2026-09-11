const mongoose = require('mongoose');

const taskSubmissionSchema = new mongoose.Schema({
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  proofData: { type: String, required: true },
  proofType: { type: String, default: 'text' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  rewardPaise: { type: Number, required: true },
  rejectionReason: { type: String, default: '' },
}, { timestamps: true });

taskSubmissionSchema.index({ taskId: 1, userId: 1, status: 1 });

module.exports = mongoose.model('TaskSubmission', taskSubmissionSchema);