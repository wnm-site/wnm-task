const express = require('express');
const router = express.Router();
const { getActiveTasks, getTask, submitTask, getUserSubmissions, getUserSubmission } = require('../controllers/taskController');
const protect = require('../middleware/auth');

router.get('/', protect, getActiveTasks);
router.get('/submissions', protect, getUserSubmissions);
router.get('/:id', protect, getTask);
router.get('/:id/submission', protect, getUserSubmission);
router.post('/:id/submit', protect, submitTask);

module.exports = router;