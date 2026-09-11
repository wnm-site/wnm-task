const mongoose = require('mongoose');

const quizAttemptSchema = new mongoose.Schema({
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answers: { type: Object, required: true },
  score: { type: Number, required: true },
  correctCount: { type: Number, required: true },
  totalQuestions: { type: Number, required: true },
  passed: { type: Boolean, default: false },
  rewarded: { type: Boolean, default: false },
}, { timestamps: true });

quizAttemptSchema.index({ quizId: 1, userId: 1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);