const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  instructions: { type: String, default: '' },
  rewardPaise: { type: Number, required: true },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'easy' },
  proofType: { type: String, enum: ['text', 'screenshot', 'image', 'url'], default: 'text' },
  maxSubmissions: { type: Number, default: null },
  deadline: { type: Date, default: null },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);