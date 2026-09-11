const express = require('express');
const router = express.Router();
const { getActiveQuizzes, getQuiz, submitQuiz } = require('../controllers/quizController');
const protect = require('../middleware/auth');

router.get('/', protect, getActiveQuizzes);
router.get('/:id', protect, getQuiz);
router.post('/:id/submit', protect, submitQuiz);

module.exports = router;