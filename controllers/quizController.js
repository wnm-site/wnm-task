const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const { creditReward } = require('./walletController');

const getActiveQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.find({ status: 'active' }).sort({ createdAt: -1 });
    res.json({ success: true, data: quizzes });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });
    res.json({ success: true, data: quiz });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const submitQuiz = async (req, res) => {
  try {
    const { answers } = req.body;
    const quizId = req.params.id;
    const userId = req.user._id;

    const quiz = await Quiz.findById(quizId);
    if (!quiz || quiz.status !== 'active') {
      return res.status(404).json({ success: false, message: 'Quiz not available' });
    }

    // Check max attempts
    if (quiz.maxAttempts) {
      const count = await QuizAttempt.countDocuments({ quizId, userId });
      if (count >= quiz.maxAttempts) {
        return res.status(400).json({ success: false, message: 'Maximum attempts reached' });
      }
    }

    // Server-side validation
    let correctCount = 0;
    quiz.questions.forEach((q, i) => {
      if (answers[i] === q.correctAnswer) correctCount++;
    });

    const score = Math.round((correctCount / quiz.questions.length) * 100);
    const passed = score >= 50;

    const attempt = await QuizAttempt.create({
      quizId,
      userId,
      answers,
      score,
      correctCount,
      totalQuestions: quiz.questions.length,
      passed,
    });

    if (passed && quiz.rewardPaise > 0) {
      await creditReward(userId, quiz.rewardPaise, 'quiz_reward', attempt._id.toString());
      attempt.rewarded = true;
      await attempt.save();
    }

    res.status(201).json({
      success: true,
      data: {
        score,
        correctCount,
        passed,
        attemptId: attempt._id,
      },
    });
  } catch (error) {
    console.error('Submit quiz error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const adminGetQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.find().sort({ createdAt: -1 });
    res.json({ success: true, data: quizzes });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const adminCreateQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.create(req.body);
    res.status(201).json({ success: true, data: quiz });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Admin: Update quiz
// @route   PUT /api/admin/quizzes/:id
const adminUpdateQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });
    res.json({ success: true, data: quiz });
  } catch (error) {
    console.error('Update quiz error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Admin: Delete quiz
// @route   DELETE /api/admin/quizzes/:id
const adminDeleteQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findByIdAndDelete(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });
    res.json({ success: true, message: 'Quiz deleted' });
  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getActiveQuizzes, getQuiz, submitQuiz,
  adminGetQuizzes, adminCreateQuiz, adminUpdateQuiz, adminDeleteQuiz,
};