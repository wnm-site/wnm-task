const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  questions: [{
    question: { type: String, required: true },
    options: [String],
    correctAnswer: { type: Number, required: true },
  }],
  rewardPaise: { type: Number, required: true },
  maxAttempts: { type: Number, default: null },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });

module.exports = mongoose.model('Quiz', quizSchema);